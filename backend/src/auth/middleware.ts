import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { prisma } from "./db.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      sub: string;
      email: string;
      name: string;
      avatarUrl: string | null;
    };
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.auth_token as string | undefined;
  const token =
    header?.startsWith("Bearer ") ? header.slice(7) : cookieToken;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = verifyAuthToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.user = user;
  next();
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
