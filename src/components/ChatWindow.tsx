import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Send, 
  Lock, 
  Shield, 
  Timer, 
  Check, 
  CheckCheck,
  MessageCircle
} from "lucide-react";
import { Profile } from "@/hooks/useAuth";
import { Conversation, Message } from "@/hooks/useMessages";
import { formatDistanceToNow } from "date-fns";

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  currentProfile: Profile | null;
  onSendMessage: (content: string, recipientPublicKey: string, isDisappearing: boolean) => Promise<void>;
}

export function ChatWindow({
  conversation,
  messages,
  currentProfile,
  onSendMessage,
}: ChatWindowProps) {
  const [message, setMessage] = useState("");
  const [isDisappearing, setIsDisappearing] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    // Focus input when conversation changes
    if (conversation && inputRef.current) {
      inputRef.current.focus();
    }
  }, [conversation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !conversation?.other_user?.public_key) return;

    setSending(true);
    try {
      await onSendMessage(message, conversation.other_user.public_key, isDisappearing);
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-secondary">
            <MessageCircle className="w-10 h-10 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Select a Conversation</h2>
            <p className="text-muted-foreground mt-1">
              Choose a chat or start a new conversation
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-primary">
            <Shield className="w-4 h-4" />
            <span>All messages are end-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  const otherUser = conversation.other_user;
  const hasEncryption = !!otherUser?.public_key;

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border glass">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {otherUser?.username?.charAt(0).toUpperCase() || "?"}
            </span>
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">{otherUser?.username || "Unknown"}</h2>
            <div className="flex items-center gap-1 text-xs text-primary">
              <Lock className="w-3 h-3" />
              <span>{hasEncryption ? "End-to-end encrypted" : "Encryption unavailable"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <Lock className="w-12 h-12 mx-auto text-primary opacity-50 mb-4" />
              <p className="text-muted-foreground">
                This is the beginning of your encrypted conversation with{" "}
                <span className="font-medium text-foreground">{otherUser?.username}</span>
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSent = msg.sender_id === currentProfile?.user_id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isSent
                        ? "message-bubble-sent rounded-br-md"
                        : "message-bubble-received rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm">{msg.decrypted_content || "[Encrypted]"}</p>
                    <div className={`flex items-center gap-1 mt-1 text-xs ${
                      isSent ? "justify-end" : "justify-start"
                    } text-muted-foreground`}>
                      {msg.is_disappearing && (
                        <Timer className="w-3 h-3 text-yellow-500" />
                      )}
                      <span>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                      {isSent && (
                        msg.seen_at ? (
                          <CheckCheck className="w-3 h-3 text-primary" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 border-t border-border glass">
        {!hasEncryption ? (
          <div className="text-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <p className="text-sm text-destructive">
              Cannot send messages - recipient's encryption is not set up
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Disappearing message toggle */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Timer className={`w-4 h-4 ${isDisappearing ? "text-yellow-500" : "text-muted-foreground"}`} />
                <Label htmlFor="disappearing" className="text-sm text-muted-foreground cursor-pointer">
                  Disappearing message
                </Label>
              </div>
              <Switch
                id="disappearing"
                checked={isDisappearing}
                onCheckedChange={setIsDisappearing}
              />
            </div>

            {/* Message input */}
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="flex-1"
                disabled={sending}
              />
              <Button 
                type="submit" 
                className="secure-gradient"
                disabled={!message.trim() || sending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Security indicator */}
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Messages are encrypted before leaving your device</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
