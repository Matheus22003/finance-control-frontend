export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  displayName: string;
}

export interface RegistrationResponse {
  email: string;
  message: string;
}

export interface ConfirmEmailRequest {
  userId: string;
  token: string;
}

export interface ConfirmEmailChangeRequest extends ConfirmEmailRequest {
  newEmail: string;
}

export interface ResetPasswordRequest extends ConfirmEmailRequest {
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: AuthUser;
}

export interface DeviceSession {
  id: string;
  deviceName: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}
