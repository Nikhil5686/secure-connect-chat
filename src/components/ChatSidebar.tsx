import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Shield, 
  Search, 
  Plus, 
  LogOut, 
  MessageCircle,
  Lock
} from "lucide-react";
import { Profile } from "@/hooks/useAuth";
import { Conversation } from "@/hooks/useMessages";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  onStartConversation: (userId: string) => Promise<unknown>;
  onSignOut: () => void;
  currentProfile: Profile | null;
}

interface UserSearchResult {
  user_id: string;
  username: string;
  public_key: string | null;
}

export function ChatSidebar({
  conversations,
  activeConversation,
  onSelectConversation,
  onStartConversation,
  onSignOut,
  currentProfile,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, public_key")
      .ilike("username", `%${query}%`)
      .neq("user_id", currentProfile?.user_id)
      .limit(10);

    if (error) {
      console.error("Search error:", error);
    } else {
      setSearchResults(data || []);
    }
    setSearching(false);
  };

  const handleStartChat = async (userId: string) => {
    await onStartConversation(userId);
    setDialogOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.other_user?.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg secure-gradient flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">SecureChat</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSignOut}
            className="text-sidebar-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        {/* Current user */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {currentProfile?.username?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {currentProfile?.username}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Encrypted</span>
            </div>
          </div>
        </div>
      </div>

      {/* New conversation button */}
      <div className="p-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full secure-gradient">
              <Plus className="w-4 h-4 mr-2" />
              New Conversation
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>Start a New Conversation</DialogTitle>
              <DialogDescription>
                Search for a user to start an encrypted chat
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {searching ? (
                  <p className="text-center text-muted-foreground py-4">Searching...</p>
                ) : searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => handleStartChat(user.user_id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium">{user.username}</p>
                        {user.public_key && (
                          <div className="flex items-center gap-1 text-xs text-primary">
                            <Lock className="w-3 h-3" />
                            <span>Encryption ready</span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                ) : searchQuery.length >= 2 ? (
                  <p className="text-center text-muted-foreground py-4">No users found</p>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Type at least 2 characters to search
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Conversations list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  activeConversation?.id === conv.id
                    ? "bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {conv.other_user?.username?.charAt(0).toUpperCase() || "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {conv.other_user?.username || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                  </p>
                </div>
                <Lock className="w-3 h-3 text-primary flex-shrink-0" />
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new encrypted chat</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
