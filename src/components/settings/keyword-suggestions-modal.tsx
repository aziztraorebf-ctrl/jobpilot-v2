"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { KeywordSuggestions } from "@/lib/schemas/keyword-suggestions";

interface KeywordSuggestionsModalProps {
  suggestions: KeywordSuggestions;
  onSave: (keywords: string[], remotePreference: "remote" | "hybrid" | "any") => Promise<void>;
  onClose: () => void;
}

export function KeywordSuggestionsModal({
  suggestions,
  onSave,
  onClose,
}: KeywordSuggestionsModalProps) {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(suggestions.keywords);
  const [remotePreference, setRemotePreference] = useState(suggestions.remote_preference);
  const [isSaving, setIsSaving] = useState(false);

  function toggleKeyword(kw: string) {
    setSelectedKeywords((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
    );
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(selectedKeywords, remotePreference);
    } finally {
      setIsSaving(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Mots-cles suggeres
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {suggestions.rationale}
        </p>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Titres de postes
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.keywords.map((kw) => (
              <button
                type="button"
                key={kw}
                onClick={() => toggleKeyword(kw)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  selectedKeywords.includes(kw)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Preference de travail
          </p>
          <div className="mt-2 flex gap-2">
            {(["remote", "hybrid", "any"] as const).map((pref) => (
              <button
                type="button"
                key={pref}
                onClick={() => setRemotePreference(pref)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  remotePreference === pref
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {pref === "remote" ? "Remote" : pref === "hybrid" ? "Hybride" : "Peu importe"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Ignorer
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || selectedKeywords.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Enregistrement..." : "Appliquer les suggestions"}
          </button>
        </div>
      </div>
    </div>
  );
}
