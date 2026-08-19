export type AuthUser = {
  userId: number;
  email?: string;
};

export type JwtPayload = {
  sub: number;
  email?: string;
};
