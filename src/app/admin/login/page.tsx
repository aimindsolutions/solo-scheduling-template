"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmail, signInWithGoogle, signInWithCustomToken } from "@/lib/firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token")?.replace(/\?+$/, "");
    if (!token) return;

    setMagicLoading(true);
    fetch(`/api/auth/magic-token`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      .then((res) => res.json())
      .then(async (data) => {
        if (data.customToken) {
          await signInWithCustomToken(data.customToken);
          router.push("/admin");
        } else {
          setError("Link expired or invalid");
          setMagicLoading(false);
        }
      })
      .catch(() => {
        setError("Auto-login failed");
        setMagicLoading(false);
      });
  }, [searchParams, router]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      router.push("/admin");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);

    try {
      await signInWithGoogle();
      router.push("/admin");
    } catch {
      setError("Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  if (magicLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Signing in...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Admin Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              Sign In
            </Button>
          </form>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            Sign in with Google
          </Button>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
