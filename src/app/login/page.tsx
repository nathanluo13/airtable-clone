"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginPageInner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  return (
    <main className="flex min-h-screen bg-white">
      {/* Left side - Login form */}
      <div className="flex flex-1 flex-col justify-center px-8 py-12 lg:px-16">
        <div className="mx-auto w-full max-w-[340px]">
          {/* Airtable Logo */}
          <div className="mb-8">
            <svg width="42" height="36" viewBox="0 0 200 170" style={{ shapeRendering: "geometricPrecision" }}>
              <path fill="rgb(255, 186, 5)" d="M90.0389,12.3675 L24.0799,39.6605 C20.4119,41.1785 20.4499,46.3885 24.1409,47.8515 L90.3759,74.1175 C96.1959,76.4255 102.6769,76.4255 108.4959,74.1175 L174.7319,47.8515 C178.4219,46.3885 178.4609,41.1785 174.7919,39.6605 L108.8339,12.3675 C102.8159,9.8775 96.0559,9.8775 90.0389,12.3675" />
              <path fill="rgb(57, 202, 255)" d="M105.3122,88.4608 L105.3122,154.0768 C105.3122,157.1978 108.4592,159.3348 111.3602,158.1848 L185.1662,129.5368 C186.8512,128.8688 187.9562,127.2408 187.9562,125.4288 L187.9562,59.8128 C187.9562,56.6918 184.8092,54.5548 181.9082,55.7048 L108.1022,84.3528 C106.4182,85.0208 105.3122,86.6488 105.3122,88.4608" />
              <path fill="rgb(220, 4, 59)" d="M88.0781,91.8464 L66.1741,102.4224 L63.9501,103.4974 L17.7121,125.6524 C14.7811,127.0664 11.0401,124.9304 11.0401,121.6294 L11.0401,60.0864 C11.0401,58.7924 11.6871,57.5874 12.7711,56.8684 C13.3491,56.4904 14.0001,56.2994 14.6551,56.2994 C15.1811,56.2994 15.7101,56.4234 16.2011,56.6674 L87.5961,87.2344 C89.7411,88.1594 90.4641,90.6854 88.0781,91.8464" />
              <path fill="rgba(0, 0, 0, 0.25)" d="M88.0781,91.8464 L66.1741,102.4224 L17.6001,56.7734 C18.1121,56.4664 18.6971,56.2994 19.2951,56.2994 C19.8211,56.2994 20.3501,56.4234 20.8411,56.6674 L87.5961,87.2344 C89.7411,88.1594 90.4641,90.6854 88.0781,91.8464" />
            </svg>
          </div>

          <h1 className="mb-8 text-[28px] font-semibold text-gray-900">
            Sign in to Airtable
          </h1>

          {error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium">Sign-in error</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {!showPasswordForm ? (
            <>
              {/* Email input */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="h-[42px] w-full rounded-[3px] border border-gray-300 px-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Continue button */}
              <button
                type="button"
                onClick={() => {
                  if (email) setShowPasswordForm(true);
                }}
                className="mb-6 h-[42px] w-full rounded-[3px] bg-[#166ee1] text-[15px] font-medium text-white transition hover:bg-[#1260c7]"
              >
                Continue
              </button>

              {/* Divider */}
              <div className="mb-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-[13px] text-gray-500">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* SSO */}
              <button
                type="button"
                className="mb-3 flex h-[42px] w-full items-center justify-center gap-2 rounded-[3px] border border-gray-300 bg-white text-[15px] font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Sign in with <span className="font-semibold">Single Sign On</span>
              </button>

              {/* Google */}
              <a
                href="/auth/signin"
                className="mb-3 flex h-[42px] w-full items-center justify-center gap-2 rounded-[3px] border border-gray-300 bg-white text-[15px] font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with <span className="font-semibold">Google</span>
              </a>

              {/* Apple */}
              <button
                type="button"
                className="mb-8 flex h-[42px] w-full items-center justify-center gap-2 rounded-[3px] border border-gray-300 bg-white text-[15px] font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Continue with <span className="font-semibold">Apple ID</span>
              </button>

              {/* Create account link */}
              <p className="text-[13px] text-gray-600">
                New to Airtable?{" "}
                <a href="/signup" className="text-[#166ee1] hover:underline">
                  Create an account
                </a>{" "}
                instead
              </p>
            </>
          ) : (
            /* Password form (shown after email) */
            <form action="/auth/signin-email" method="POST" className="space-y-4">
              <input type="hidden" name="email" value={email} />
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  Email
                </label>
                <div className="flex h-[42px] items-center rounded-[3px] border border-gray-300 bg-gray-50 px-3 text-[15px] text-gray-700">
                  {email}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  className="h-[42px] w-full rounded-[3px] border border-gray-300 px-3 text-[15px] text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="h-[42px] w-full rounded-[3px] bg-[#166ee1] text-[15px] font-medium text-white transition hover:bg-[#1260c7]"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordForm(false)}
                className="w-full text-center text-[13px] text-[#166ee1] hover:underline"
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Right side - Promotional card */}
      <div className="hidden flex-1 items-center justify-center bg-white p-12 lg:flex">
        <div
          className="h-[580px] w-[395px] rounded-xl bg-cover bg-center"
          style={{ backgroundImage: "url('https://static.airtable.com/images/sign_in_page/omni_signin_large@2x.png')" }}
        />
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
