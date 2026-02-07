import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Row,
  Column,
  Text,
  Heading,
  Hr,
  Preview,
} from "@react-email/components";

interface StaleApplication {
  jobTitle: string;
  company: string;
  appliedDaysAgo: number;
  status: string;
  description?: string | null;
}

interface FollowUpReminderProps {
  applications: StaleApplication[];
  date: string;
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd() + "...";
}

function urgencyColor(days: number): string {
  if (days >= 30) return "#dc2626";
  if (days >= 21) return "#ea580c";
  return "#d97706";
}

function urgencyBg(days: number): string {
  if (days >= 30) return "#fef2f2";
  if (days >= 21) return "#fff7ed";
  return "#fffbeb";
}

function urgencyLabel(days: number): string {
  if (days >= 30) return "Urgent";
  if (days >= 21) return "Retard";
  return "A relancer";
}

function statusLabel(status: string): string {
  switch (status) {
    case "applied":
      return "Postule";
    case "interview":
      return "Entrevue";
    case "phone_screen":
      return "Pre-selection";
    default:
      return status;
  }
}

export function FollowUpReminder({
  applications,
  date,
}: FollowUpReminderProps) {
  const urgentCount = applications.filter((a) => a.appliedDaysAgo >= 30).length;

  return (
    <Html lang="fr">
      <Head />
      <Preview>{`${applications.length} candidature(s) a relancer`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={brandName}>JobPilot</Text>
            <Text style={headerSubtitle}>Rappel de suivi</Text>
          </Section>

          {/* Summary banner */}
          <Section style={summaryBanner}>
            <Heading style={summaryNumber}>{applications.length}</Heading>
            <Text style={summaryLabel}>
              candidature{applications.length > 1 ? "s" : ""} sans mise a jour
            </Text>
            {urgentCount > 0 && (
              <Text style={urgentNote}>
                dont {urgentCount} urgente{urgentCount > 1 ? "s" : ""} (+30
                jours)
              </Text>
            )}
            <Text style={summaryDate}>{date}</Text>
          </Section>

          {/* Applications list */}
          <Section style={appsSection}>
            <Heading as="h2" style={sectionTitle}>
              Candidatures a relancer
            </Heading>
            <Text style={sectionSubtitle}>
              Un suivi proactif augmente vos chances de 30%. Envoyez un bref
              message de relance pour chacune.
            </Text>
            {applications.map((app, i) => (
              <Section key={i} style={appCard}>
                <Row>
                  <Column style={appInfoCol}>
                    <Text style={appTitle}>{app.jobTitle}</Text>
                    <Text style={appCompany}>{app.company}</Text>
                    <Text style={appStatus}>
                      Statut : {statusLabel(app.status)}
                    </Text>
                    {app.description && (
                      <Text style={appDescription}>
                        {truncate(app.description, 120)}
                      </Text>
                    )}
                  </Column>
                  <Column style={appBadgeCol}>
                    <Text
                      style={{
                        ...daysBadge,
                        color: urgencyColor(app.appliedDaysAgo),
                        backgroundColor: urgencyBg(app.appliedDaysAgo),
                      }}
                    >
                      {app.appliedDaysAgo}j
                    </Text>
                    <Text
                      style={{
                        ...urgencyTag,
                        color: urgencyColor(app.appliedDaysAgo),
                      }}
                    >
                      {urgencyLabel(app.appliedDaysAgo)}
                    </Text>
                  </Column>
                </Row>
              </Section>
            ))}
          </Section>

          <Hr style={hr} />

          {/* Tips */}
          <Section style={tipsSection}>
            <Text style={tipsTitle}>Conseils de relance</Text>
            <Text style={tipItem}>
              Mentionnez le poste et la date de candidature dans votre message.
            </Text>
            <Text style={tipItem}>
              Restez bref et professionnel (3-4 phrases max).
            </Text>
            <Text style={tipItem}>
              Reaffirmez votre interet pour le poste et l&apos;entreprise.
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              JobPilot - Votre assistant de recherche d&apos;emploi
            </Text>
            <Text style={footerMuted}>
              Rappels envoyes pour les candidatures sans mise a jour depuis 14+
              jours. Gerez vos preferences dans les parametres.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default FollowUpReminder;

const main = {
  backgroundColor: "#f1f5f9",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};
const container = {
  margin: "0 auto",
  padding: "0",
  maxWidth: "600px",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  overflow: "hidden" as const,
};
const header = {
  backgroundColor: "#1e3a5f",
  padding: "28px 32px 20px",
  textAlign: "center" as const,
};
const brandName = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: "bold" as const,
  margin: "0 0 4px",
  letterSpacing: "0.5px",
};
const headerSubtitle = {
  color: "#93c5fd",
  fontSize: "13px",
  margin: "0",
};
const summaryBanner = {
  backgroundColor: "#fffbeb",
  padding: "24px 32px",
  textAlign: "center" as const,
  borderBottom: "1px solid #fde68a",
};
const summaryNumber = {
  color: "#92400e",
  fontSize: "42px",
  fontWeight: "bold" as const,
  margin: "0",
  lineHeight: "1",
};
const summaryLabel = {
  color: "#78350f",
  fontSize: "15px",
  margin: "8px 0 0",
};
const urgentNote = {
  color: "#dc2626",
  fontSize: "13px",
  fontWeight: "600" as const,
  margin: "4px 0 0",
};
const summaryDate = {
  color: "#a16207",
  fontSize: "12px",
  margin: "4px 0 0",
};
const appsSection = { padding: "24px 32px" };
const sectionTitle = {
  color: "#1e293b",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};
const sectionSubtitle = {
  color: "#64748b",
  fontSize: "13px",
  margin: "0 0 16px",
  lineHeight: "1.5",
};
const appCard = {
  padding: "14px 16px",
  marginBottom: "10px",
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};
const appInfoCol = { verticalAlign: "top" as const, width: "70%" };
const appBadgeCol = {
  verticalAlign: "top" as const,
  width: "30%",
  textAlign: "right" as const,
};
const appTitle = {
  fontSize: "15px",
  fontWeight: "600" as const,
  color: "#0f172a",
  margin: "0 0 4px",
};
const appCompany = {
  fontSize: "14px",
  color: "#475569",
  margin: "0 0 2px",
};
const appStatus = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "0",
};
const appDescription = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "4px 0 0",
  lineHeight: "1.4",
  fontStyle: "italic" as const,
};
const daysBadge = {
  display: "inline-block" as const,
  fontSize: "16px",
  fontWeight: "bold" as const,
  padding: "4px 10px",
  borderRadius: "16px",
  margin: "0",
  textAlign: "center" as const,
};
const urgencyTag = {
  fontSize: "11px",
  fontWeight: "600" as const,
  margin: "4px 0 0",
  textAlign: "right" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.3px",
};
const hr = { borderColor: "#e2e8f0", margin: "0" };
const tipsSection = { padding: "20px 32px" };
const tipsTitle = {
  fontSize: "13px",
  fontWeight: "600" as const,
  color: "#64748b",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};
const tipItem = {
  fontSize: "13px",
  color: "#64748b",
  margin: "0 0 4px",
  lineHeight: "1.5",
  paddingLeft: "12px",
  borderLeft: "2px solid #e2e8f0",
};
const footerSection = { padding: "20px 32px", textAlign: "center" as const };
const footerText = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: "600" as const,
  margin: "0 0 4px",
};
const footerMuted = {
  color: "#94a3b8",
  fontSize: "11px",
  margin: "0",
  lineHeight: "1.4",
};
