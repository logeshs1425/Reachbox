import { Router, type RequestHandler } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { signAuthToken } from "../auth/middleware.js";
import { redis } from "../redis.js";
import { randomBytes } from "node:crypto";

export const authRouter = Router();

const googleOAuthConfigured = Boolean(
  config.google.clientId && config.google.clientSecret
);

if (googleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            done(new Error("No email from Google"));
            return;
          }

          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            create: {
              googleId: profile.id,
              email,
              name: profile.displayName ?? email,
              avatarUrl: profile.photos?.[0]?.value,
            },
            update: {
              name: profile.displayName ?? email,
              avatarUrl: profile.photos?.[0]?.value,
            },
          });

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
}

const requireGoogleOAuthConfiguration: RequestHandler = (_req, res, next) => {
  if (!googleOAuthConfigured) {
    res.status(503).json({
      error:
        "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env, then restart the API.",
    });
    return;
  }
  next();
};

authRouter.get(
  "/google",
  requireGoogleOAuthConfiguration,
  passport.authenticate("google", {
    scope: ["openid", "email", "profile"],
    accessType: "offline",
    prompt: "consent",
    session: false,
  })
);

authRouter.get(
  "/google/callback",
  requireGoogleOAuthConfiguration,
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${config.frontendUrl}/login?error=auth`,
  }),
  async (req, res) => {
    const user = req.user as {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
    };
    const token = signAuthToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.nodeEnv === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const code = randomBytes(32).toString("base64url");
    await redis.set(`auth:exchange:${code}`, token, "EX", 60, "NX");
    res.redirect(`${config.frontendUrl}/auth/callback?code=${encodeURIComponent(code)}`);
  }
);

authRouter.post("/exchange", async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!code || code.length > 128) {
    res.status(400).json({ error: "Invalid login code" });
    return;
  }
  const token = await redis.getdel(`auth:exchange:${code}`);
  if (!token) {
    res.status(401).json({ error: "Login code expired or already used" });
    return;
  }
  res.json({ token });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("auth_token");
  res.json({ ok: true });
});
