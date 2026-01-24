-- Create profiles table for user info and public encryption keys
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  public_key TEXT, -- For end-to-end encryption
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_two UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_one, participant_two)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  is_disappearing BOOLEAN DEFAULT FALSE,
  seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is part of a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = conv_id
    AND (participant_one = auth.uid() OR participant_two = auth.uid())
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Users can create their own profile" 
  ON public.profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (user_id = auth.uid());

-- Conversations policies
CREATE POLICY "Users can view their conversations" 
  ON public.conversations FOR SELECT 
  TO authenticated 
  USING (participant_one = auth.uid() OR participant_two = auth.uid());

CREATE POLICY "Users can create conversations" 
  ON public.conversations FOR INSERT 
  TO authenticated 
  WITH CHECK (participant_one = auth.uid() OR participant_two = auth.uid());

CREATE POLICY "Users can delete their conversations" 
  ON public.conversations FOR DELETE 
  TO authenticated 
  USING (participant_one = auth.uid() OR participant_two = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages in their conversations" 
  ON public.messages FOR SELECT 
  TO authenticated 
  USING (public.is_conversation_participant(conversation_id));

CREATE POLICY "Users can send messages to their conversations" 
  ON public.messages FOR INSERT 
  TO authenticated 
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id));

CREATE POLICY "Users can update messages they sent" 
  ON public.messages FOR UPDATE 
  TO authenticated 
  USING (sender_id = auth.uid());

CREATE POLICY "Users can delete messages in their conversations" 
  ON public.messages FOR DELETE 
  TO authenticated 
  USING (public.is_conversation_participant(conversation_id));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup - creates profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();