import { currentUser } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from './supabase';
import { logger } from './logger';

export interface UserProfile {
  id: string;
  user_id: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserWithProfile {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses: Array<{
    emailAddress: string;
    id: string;
  }>;
  imageUrl?: string;
  profile?: UserProfile;
}

export async function getCurrentUser(): Promise<UserWithProfile | null> {
  try {
    const user = await currentUser();
    if (!user) return null;

    // Get user profile from Supabase
    const supabase = await createSupabaseServerClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching user profile', { userId: user.id, error });
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddresses: user.emailAddresses.map(email => ({
        emailAddress: email.emailAddress,
        id: email.id,
      })),
      imageUrl: user.imageUrl,
      profile: profile || undefined,
    };
  } catch (error) {
    logger.error('Error getting current user', { error });
    return null;
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Profile not found
      }
      logger.error('Error fetching user profile', { userId, error });
      return null;
    }

    return data;
  } catch (error) {
    logger.error('Error getting user profile', { userId, error });
    return null;
  }
}

export async function createUserProfile(
  userId: string,
  profileData: Partial<Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<UserProfile | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        ...profileData,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating user profile', { userId, error });
      return null;
    }

    logger.info('User profile created', { userId });
    return data;
  } catch (error) {
    logger.error('Error creating user profile', { userId, error });
    return null;
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<UserProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<UserProfile | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user profile', { userId, error });
      return null;
    }

    logger.info('User profile updated', { userId });
    return data;
  } catch (error) {
    logger.error('Error updating user profile', { userId, error });
    return null;
  }
}

export async function deleteUserProfile(userId: string): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error('Error deleting user profile', { userId, error });
      return false;
    }

    logger.info('User profile deleted', { userId });
    return true;
  } catch (error) {
    logger.error('Error deleting user profile', { userId, error });
    return false;
  }
}

export async function getUserDisplayName(user: UserWithProfile): Promise<string> {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.emailAddresses.length > 0) {
    return user.emailAddresses[0].emailAddress;
  }
  return 'Anonymous User';
}

export async function isUserProfileComplete(user: UserWithProfile): Promise<boolean> {
  return !!(
    user.firstName &&
    user.lastName &&
    user.profile
  );
}

export function getAvatarUrl(user: UserWithProfile): string {
  return user.profile?.avatar_url || user.imageUrl || '';
}

export function getUserInitials(user: UserWithProfile): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.firstName) {
    return user.firstName[0].toUpperCase();
  }
  if (user.emailAddresses.length > 0) {
    return user.emailAddresses[0].emailAddress[0].toUpperCase();
  }
  return 'U';
}

// Helper to ensure user profile exists (create if needed)
export async function ensureUserProfile(userId: string): Promise<UserProfile | null> {
  let profile = await getUserProfile(userId);
  
  if (!profile) {
    profile = await createUserProfile(userId, {
      is_public: false,
    });
  }

  return profile;
}
