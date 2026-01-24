import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { encryptMessage, decryptMessage, getPrivateKey } from "@/lib/encryption";
import { useToast } from "@/hooks/use-toast";

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  is_disappearing: boolean;
  seen_at: string | null;
  created_at: string;
  decrypted_content?: string;
}

export interface Conversation {
  id: string;
  participant_one: string;
  participant_two: string;
  created_at: string;
  updated_at: string;
  other_user?: {
    id: string;
    username: string;
    public_key: string | null;
  };
  last_message?: Message;
}

export function useMessages(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return;
    }

    // Fetch other user's profile for each conversation
    const conversationsWithUsers = await Promise.all(
      (data || []).map(async (conv) => {
        const otherUserId = conv.participant_one === userId 
          ? conv.participant_two 
          : conv.participant_one;

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, username, public_key")
          .eq("user_id", otherUserId)
          .single();

        return {
          ...conv,
          other_user: profile ? {
            id: profile.user_id,
            username: profile.username,
            public_key: profile.public_key,
          } : undefined,
        };
      })
    );

    setConversations(conversationsWithUsers);
    setLoading(false);
  }, [userId]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return;
    }

    // Decrypt messages
    const privateKey = getPrivateKey();
    const decryptedMessages = await Promise.all(
      (data || []).map(async (msg) => {
        let decrypted = "[Encrypted]";
        if (privateKey) {
          try {
            decrypted = await decryptMessage(msg.encrypted_content, privateKey);
          } catch {
            decrypted = "[Unable to decrypt]";
          }
        }
        return { ...msg, decrypted_content: decrypted };
      })
    );

    setMessages(decryptedMessages);

    // Mark seen disappearing messages for deletion
    const unseenMessages = decryptedMessages.filter(
      msg => msg.is_disappearing && !msg.seen_at && msg.sender_id !== userId
    );

    for (const msg of unseenMessages) {
      await supabase
        .from("messages")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", msg.id);
    }
  }, [userId]);

  // Send a message
  const sendMessage = async (
    content: string, 
    recipientPublicKey: string, 
    isDisappearing: boolean = false
  ) => {
    if (!activeConversation || !userId) return;

    try {
      const encrypted = await encryptMessage(content, recipientPublicKey);

      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversation.id,
        sender_id: userId,
        encrypted_content: encrypted,
        is_disappearing: isDisappearing,
      });

      if (error) throw error;

      // Update conversation timestamp
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeConversation.id);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  // Start a new conversation
  const startConversation = async (otherUserId: string) => {
    if (!userId) return null;

    // Check if conversation already exists
    const existing = conversations.find(
      c => (c.participant_one === otherUserId || c.participant_two === otherUserId)
    );

    if (existing) {
      setActiveConversation(existing);
      return existing;
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        participant_one: userId,
        participant_two: otherUserId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      return null;
    }

    await fetchConversations();
    return data;
  };

  // Delete seen disappearing messages
  const deleteSeenMessages = useCallback(async () => {
    if (!activeConversation) return;

    const now = new Date();
    const fiveSecondsAgo = new Date(now.getTime() - 5000);

    const toDelete = messages.filter(
      msg => msg.is_disappearing && 
             msg.seen_at && 
             new Date(msg.seen_at) < fiveSecondsAgo
    );

    for (const msg of toDelete) {
      await supabase.from("messages").delete().eq("id", msg.id);
    }
  }, [activeConversation, messages]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    fetchConversations();

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        async (payload) => {
          if (activeConversation && payload.new && 
              (payload.new as Message).conversation_id === activeConversation.id) {
            await fetchMessages(activeConversation.id);
          }
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchConversations, activeConversation, fetchMessages]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation.id);
    }
  }, [activeConversation, fetchMessages]);

  // Cleanup disappearing messages periodically
  useEffect(() => {
    const interval = setInterval(deleteSeenMessages, 5000);
    return () => clearInterval(interval);
  }, [deleteSeenMessages]);

  return {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    loading,
    sendMessage,
    startConversation,
    fetchConversations,
  };
}
