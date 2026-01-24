import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { AuthForm } from "@/components/AuthForm";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatWindow } from "@/components/ChatWindow";
import { Shield } from "lucide-react";

const Index = () => {
  const { user, profile, loading, signUp, signIn, signOut } = useAuth();
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    messages,
    sendMessage,
    startConversation,
  } = useMessages(user?.id);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl secure-gradient animate-pulse">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading SecureChat...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show auth form
  if (!user) {
    return <AuthForm onSignUp={signUp} onSignIn={signIn} />;
  }

  // Authenticated - show chat interface
  return (
    <div className="h-screen flex overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        activeConversation={activeConversation}
        onSelectConversation={setActiveConversation}
        onStartConversation={startConversation}
        onSignOut={signOut}
        currentProfile={profile}
      />
      <ChatWindow
        conversation={activeConversation}
        messages={messages}
        currentProfile={profile}
        onSendMessage={sendMessage}
      />
    </div>
  );
};

export default Index;
