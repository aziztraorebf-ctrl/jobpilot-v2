"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { SearchPreferencesData } from "./settings-page-client";

interface RotationProfile {
  resume_id: string | null;
  keywords: string[];
  label: string;
}

interface RotationProfilesSettingsProps {
  searchPreferences: SearchPreferencesData;
  onSave: (updates: Partial<SearchPreferencesData>) => Promise<void>;
}

export function RotationProfilesSettings({
  searchPreferences,
  onSave,
}: RotationProfilesSettingsProps) {
  const profiles = (searchPreferences.rotation_profiles ?? []) as RotationProfile[];
  const [rotationEnabled, setRotationEnabled] = useState(
    searchPreferences.rotation_enabled ?? false
  );
  const [rotationDays, setRotationDays] = useState<1 | 2 | 3>(
    (searchPreferences.rotation_days as 1 | 2 | 3) ?? 2
  );
  const [activeIndex, setActiveIndex] = useState(
    searchPreferences.active_profile_index ?? 0
  );
  const [isSaving, setIsSaving] = useState(false);

  if (profiles.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Ajoutez un deuxième CV analysé pour activer la rotation automatique.
      </div>
    );
  }

  async function handleForceProfile(index: number) {
    setIsSaving(true);
    try {
      await onSave({
        active_profile_index: index,
        last_rotation_at: new Date().toISOString(),
      });
      setActiveIndex(index);
      toast.success("Profil activé");
    } catch {
      toast.error("Échec de l'activation du profil");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveRotation() {
    setIsSaving(true);
    try {
      await onSave({ rotation_enabled: rotationEnabled, rotation_days: rotationDays });
      toast.success("Configuration de rotation sauvegardée");
    } catch {
      toast.error("Échec de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Rotation automatique</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Alterne entre vos deux profils automatiquement
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRotationEnabled((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            rotationEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              rotationEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {rotationEnabled && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
            Durée par profil
          </p>
          <div className="flex gap-2">
            {([1, 2, 3] as const).map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setRotationDays(d)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  rotationDays === d
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {d} jour{d > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Profils</p>
        {profiles.map((profile, index) => (
          <div
            key={index}
            className={`flex items-center justify-between rounded-lg border p-3 ${
              activeIndex === index
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {profile.label}
                {activeIndex === index && (
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">• Actif</span>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {profile.keywords.slice(0, 3).join(", ")}
                {profile.keywords.length > 3 && ` +${profile.keywords.length - 3}`}
              </p>
            </div>
            {activeIndex !== index && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleForceProfile(index)}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
              >
                Activer maintenant
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={isSaving}
        onClick={handleSaveRotation}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSaving ? "Enregistrement..." : "Sauvegarder la configuration"}
      </button>
    </div>
  );
}
