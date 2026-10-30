import type { UpdateCurrentUserInput } from "../types/user";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  refreshUser: () => Promise<AuthUser>;
  updateUser: (input: UpdateCurrentUserInput) => Promise<AuthUser>;
  logout: () => void;
}
