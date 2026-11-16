import React from "react";

export type LegalDocType = "terms" | "privacy" | null;

interface LegalModalProps {
  doc: LegalDocType;
  onClose: () => void;
}

export const RIOT_DISCLAIMER =
  "Apex isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

export function LegalModal({ doc, onClose }: LegalModalProps) {
  if (!doc) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-semibold text-white">
            {doc === "terms" ? "Terms of Service" : "Privacy Policy"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2.5 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            Close
          </button>
        </div>

        {doc === "terms" ? (
          <div className="space-y-4 text-sm leading-relaxed text-zinc-300">
            <p className="text-xs text-zinc-500">Last Updated: November 2026</p>
            <section>
              <h3 className="mb-1 font-medium text-white">1. Acceptance of Terms</h3>
              <p>
                By accessing or using Apex (the desktop application or web preview at
                apex.damferr.online), you agree to be bound by these Terms of Service.
              </p>
            </section>
            <section>
              <h3 className="mb-1 font-medium text-white">2. Riot Games Policy & Fair Play</h3>
              <p>
                Apex provides statistical analysis, draft recommendations, and post-game
                reviews using official Riot Games APIs. Apex does not provide hidden
                in-game information (such as fog-of-war data or automatic enemy cooldown
                tracking) and does not automate gameplay or inject inputs. You agree to
                use Apex in compliance with the Riot Games Terms of Service.
              </p>
            </section>
            <section>
              <h3 className="mb-1 font-medium text-white">3. Prototype & Disclaimer of Warranties</h3>
              <p>
                Apex is currently provided &ldquo;as is&rdquo; without warranties of any
                kind. During the pre-release prototype phase, displayed statistics may use
                simulated or sample datasets for UI demonstration purposes.
              </p>
            </section>
            <section>
              <h3 className="mb-1 font-medium text-white">4. Intellectual Property</h3>
              <p>{RIOT_DISCLAIMER}</p>
            </section>
          </div>
        ) : (
          <div className="space-y-4 text-sm leading-relaxed text-zinc-300">
            <p className="text-xs text-zinc-500">Last Updated: November 2026</p>
            <section>
              <h3 className="mb-1 font-medium text-white">1. Information We Collect</h3>
              <p>
                When you search for a Riot ID or connect your local League Client, Apex
                processes publicly available match history, rank, mastery, and live-game
                data provided by the official Riot Games API. Local preferences and player
                notes are stored locally on your device.
              </p>
            </section>
            <section>
              <h3 className="mb-1 font-medium text-white">2. How We Use Information</h3>
              <p>
                Collected match and account data is used solely to calculate champion
                statistics, draft win-probability estimates, and personal performance
                analytics. We never sell or rent your personal data or Riot account
                identifiers to third parties.
              </p>
            </section>
            <section>
              <h3 className="mb-1 font-medium text-white">3. Data Retention & Deletion</h3>
              <p>
                You may clear local cache and stored preferences at any time via the
                Settings menu, or request deletion of any synced account data by contacting
                us.
              </p>
            </section>
            <section>
              <h3 className="mb-1 font-medium text-white">4. Riot Games Disclaimer</h3>
              <p>{RIOT_DISCLAIMER}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
