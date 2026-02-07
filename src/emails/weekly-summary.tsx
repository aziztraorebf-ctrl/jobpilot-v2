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

interface WeeklySummaryProps {
  weekOf: string;
  newJobsCount: number;
  appliedCount: number;
  interviewCount: number;
  avgScore: number;
  topJobs: { title: string; company: string; score: number; description?: string | null }[];
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd() + "...";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#d97706";
  return "#6b7280";
}

export function WeeklySummary({
  weekOf,
  newJobsCount,
  appliedCount,
  interviewCount,
  avgScore,
  topJobs,
}: WeeklySummaryProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`Resume hebdomadaire - Semaine du ${weekOf}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={brandName}>JobPilot</Text>
            <Text style={headerSubtitle}>Resume hebdomadaire</Text>
          </Section>

          {/* Week banner */}
          <Section style={weekBanner}>
            <Text style={weekLabel}>Semaine du {weekOf}</Text>
          </Section>

          {/* Stats grid */}
          <Section style={statsSection}>
            <Heading as="h2" style={sectionTitle}>
              Votre activite
            </Heading>
            <Row>
              <Column style={statCard}>
                <Text style={statNumber}>{newJobsCount}</Text>
                <Text style={statLabel}>Nouvelles offres</Text>
              </Column>
              <Column style={statCard}>
                <Text style={statNumber}>{appliedCount}</Text>
                <Text style={statLabel}>Candidatures</Text>
              </Column>
            </Row>
            <Row style={{ marginTop: "8px" }}>
              <Column style={statCard}>
                <Text style={statNumber}>{interviewCount}</Text>
                <Text style={statLabel}>Entrevues</Text>
              </Column>
              <Column style={statCard}>
                <Text
                  style={{
                    ...statNumber,
                    color: scoreColor(avgScore),
                  }}
                >
                  {avgScore}%
                </Text>
                <Text style={statLabel}>Score moyen</Text>
              </Column>
            </Row>
          </Section>

          <Hr style={hr} />

          {/* Top jobs */}
          {topJobs.length > 0 && (
            <Section style={topJobsSection}>
              <Heading as="h2" style={sectionTitle}>
                Top offres de la semaine
              </Heading>
              {topJobs.map((job, i) => (
                <Section key={i} style={topJobRow}>
                  <Row>
                    <Column style={rankCol}>
                      <Text style={rankBadge}>{i + 1}</Text>
                    </Column>
                    <Column style={topJobInfoCol}>
                      <Text style={topJobTitle}>{job.title}</Text>
                      <Text style={topJobCompany}>{job.company}</Text>
                      {job.description && (
                        <Text style={topJobDescription}>
                          {truncate(job.description, 120)}
                        </Text>
                      )}
                    </Column>
                    <Column style={topJobScoreCol}>
                      <Text
                        style={{
                          ...topJobScore,
                          color: scoreColor(job.score),
                        }}
                      >
                        {job.score}%
                      </Text>
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>
          )}

          {topJobs.length === 0 && (
            <Section style={emptySection}>
              <Text style={emptyText}>
                Aucune offre avec un score eleve cette semaine. Ajustez vos
                preferences de recherche pour de meilleurs resultats.
              </Text>
            </Section>
          )}

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              JobPilot - Votre assistant de recherche d&apos;emploi
            </Text>
            <Text style={footerMuted}>
              Resume genere automatiquement chaque lundi. Gerez vos preferences
              dans les parametres.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklySummary;

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
const weekBanner = {
  backgroundColor: "#eff6ff",
  padding: "14px 32px",
  textAlign: "center" as const,
  borderBottom: "1px solid #dbeafe",
};
const weekLabel = {
  color: "#1e3a5f",
  fontSize: "15px",
  fontWeight: "600" as const,
  margin: "0",
};
const statsSection = { padding: "24px 32px" };
const sectionTitle = {
  color: "#1e293b",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 16px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};
const statCard = {
  textAlign: "center" as const,
  padding: "16px 8px",
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  width: "50%",
};
const statNumber = {
  color: "#1e3a5f",
  fontSize: "28px",
  fontWeight: "bold" as const,
  margin: "0",
  lineHeight: "1",
};
const statLabel = {
  color: "#64748b",
  fontSize: "12px",
  margin: "6px 0 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.3px",
};
const hr = { borderColor: "#e2e8f0", margin: "0" };
const topJobsSection = { padding: "24px 32px" };
const topJobRow = {
  padding: "10px 12px",
  marginBottom: "6px",
  backgroundColor: "#f8fafc",
  borderRadius: "6px",
  border: "1px solid #e2e8f0",
};
const rankCol = {
  width: "36px",
  verticalAlign: "middle" as const,
};
const rankBadge = {
  backgroundColor: "#1e3a5f",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: "bold" as const,
  width: "24px",
  height: "24px",
  lineHeight: "24px",
  borderRadius: "12px",
  textAlign: "center" as const,
  margin: "0",
  display: "inline-block" as const,
};
const topJobInfoCol = {
  verticalAlign: "middle" as const,
  paddingLeft: "8px",
};
const topJobScoreCol = {
  width: "60px",
  verticalAlign: "middle" as const,
  textAlign: "right" as const,
};
const topJobTitle = {
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#0f172a",
  margin: "0 0 2px",
};
const topJobCompany = {
  fontSize: "13px",
  color: "#64748b",
  margin: "0",
};
const topJobDescription = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "4px 0 0",
  lineHeight: "1.4",
};
const topJobScore = {
  fontSize: "15px",
  fontWeight: "bold" as const,
  margin: "0",
};
const emptySection = { padding: "24px 32px" };
const emptyText = {
  color: "#64748b",
  fontSize: "14px",
  textAlign: "center" as const,
  margin: "0",
  fontStyle: "italic" as const,
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
