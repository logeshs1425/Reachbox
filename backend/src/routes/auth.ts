import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { signAuthToken } from "./middleware.js";

export const authRouter = Router();

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

authRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

authRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${config.frontendUrl}/login?error=auth`,
  }),
  (req, res) => {
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

    res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);
  }
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("auth_token");
  res.json({ ok: true });
});
