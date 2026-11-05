export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  fonction: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  roles: string[];
  id?: number;  // ID du membre
}

export interface RegisterResponse {
  id: number;
  username: string;
  etatCompte: string;
}

export interface AuthUser {
  authenticated: boolean;
  username?: string;
}
