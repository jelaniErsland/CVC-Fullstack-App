"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function AdminContactSignIn({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      const callbackUrl = new URL("/admin/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", nextPath);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callbackUrl.toString(),
          shouldCreateUser: false,
        },
      });

      if (error) {
        setMessage("Sign-in could not start. Check the email or contact the project owner.");
      } else {
        setMessage(
          "If this email has invited project access, use the sign-in link sent to it.",
        );
      }
    } catch {
      setMessage("Sign-in is temporarily unavailable. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <Field
        autoComplete="email"
        id="email"
        label="Email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="contact@example.com"
        required
        type="email"
        value={email}
      />
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Sending sign-in link…" : "Email me a sign-in link"}
      </Button>
      <p aria-live="polite" className="min-h-5 text-sm leading-6 text-slate-600">
        {message}
      </p>
    </form>
  );
}
