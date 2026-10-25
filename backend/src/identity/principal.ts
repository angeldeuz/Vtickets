export interface Principal {
  authUserId: string;
  userId: string;
  roles: string[];
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  principal?: Principal;
}
