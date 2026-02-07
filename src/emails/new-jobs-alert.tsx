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
  Link,
  Button,
  Preview,
} from "@react-email/components";

interface JobMatch {
  title: string;
  company: string;
  location: string | null;
  score: number;
  sourceUrl: string;
  description?: string | null;
}

interface NewJobsAlertProps {
  jobs: JobMatch[];
  threshold: number;
  date: string;
  keywords?: string[];
}

function scoreColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#d97706";
  return "#6b7280";
}

function scoreBg(score: number): string {
  if (score >= 80) return "#ecfdf5";
  if (score >= 60) return "#fffbeb";
  return "#f3f4f6";
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd() + "...";
}

export function NewJobsAlert({ jobs, threshold, date, keywords }: NewJobsAlertProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`${jobs.length} nouvelle(s) offre(s) au-dessus de ${threshold}%`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={brandName}>JobPilot</Text>
            <Text style={headerSubtitle}>Alerte nouvelles offres</Text>
          </Section>

          {/* Summary banner */}
          <Section style={summaryBanner}>
            <Heading style={summaryNumber}>{jobs.length}</Heading>
            <Text style={summaryLabel}>
              offre{jobs.length > 1 ? "s" : ""} avec un score &ge; {threshold}%
            </Text>
            <Text style={summaryDate}>{date}</Text>
          </Section>

          {/* Job cards */}
          <Section style={jobsSection}>
            <Heading as="h2" style={sectionTitle}>
              Offres correspondantes
            </Heading>
            {jobs.map((job, i) => (
              <Section key={i} style={jobCard}>
                <Row>
                  <Column style={jobInfoCol}>
                    <Text style={jobTitle}>{job.title}</Text>
                    <Text style={jobCompany}>{job.company}</Text>
                    {job.location && (
                      <Text style={jobLocation}>{job.location}</Text>
                    )}
                  </Column>
                  <Column style={scoreCol}>
                    <Text
                      style={{
                        ...scoreBadgeStyle,
                        color: scoreColor(job.score),
                        backgroundColor: scoreBg(job.score),
                      }}
                    >
                      {job.score}%
                    </Text>
                  </Column>
                </Row>
                {job.description && (
                  <Text style={jobDescription}>
                    {truncate(job.description, 160)}
                  </Text>
                )}
                <Button href={job.sourceUrl} style={viewButton}>
                  Voir l&apos;offre
                </Button>
              </Section>
            ))}
          </Section>

          {/* Keywords context */}
          {keywords && keywords.length > 0 && (
            <Section style={keywordsSection}>
              <Text style={keywordsLabel}>
                Vos criteres de recherche : {keywords.join(", ")}
              </Text>
            </Section>
          )}

          <Hr style={hr} />

          {/* Tips */}
          <Section style={tipsSection}>
            <Text style={tipsTitle}>Conseils</Text>
            <Text style={tipsText}>
              Les offres avec un score &ge; 80% correspondent fortement a votre
              profil. Postulez rapidement pour maximiser vos chances.
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              JobPilot - Votre assistant de recherche d&apos;emploi
            </Text>
            <Text style={footerMuted}>
              Vous recevez cet email car les alertes nouvelles offres sont
              activees dans vos preferences.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default NewJobsAlert;

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
  backgroundColor: "#eff6ff",
  padding: "24px 32px",
  textAlign: "center" as const,
  borderBottom: "1px solid #dbeafe",
};
const summaryNumber = {
  color: "#1e3a5f",
  fontSize: "42px",
  fontWeight: "bold" as const,
  margin: "0",
  lineHeight: "1",
};
const summaryLabel = {
  color: "#475569",
  fontSize: "15px",
  margin: "8px 0 0",
};
const summaryDate = {
  color: "#94a3b8",
  fontSize: "12px",
  margin: "4px 0 0",
};
const jobsSection = { padding: "24px 32px" };
const sectionTitle = {
  color: "#1e293b",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 16px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};
const jobCard = {
  padding: "16px",
  marginBottom: "12px",
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};
const jobInfoCol = { verticalAlign: "top" as const, width: "75%" };
const scoreCol = {
  verticalAlign: "top" as const,
  width: "25%",
  textAlign: "right" as const,
};
const jobTitle = {
  fontSize: "15px",
  fontWeight: "600" as const,
  color: "#0f172a",
  margin: "0 0 4px",
};
const jobCompany = {
  fontSize: "14px",
  color: "#475569",
  margin: "0 0 2px",
};
const jobLocation = {
  fontSize: "13px",
  color: "#94a3b8",
  margin: "0",
};
const scoreBadgeStyle = {
  display: "inline-block" as const,
  fontSize: "16px",
  fontWeight: "bold" as const,
  padding: "6px 12px",
  borderRadius: "20px",
  margin: "0",
  textAlign: "center" as const,
};
const viewButton = {
  backgroundColor: "#1e3a5f",
  color: "#ffffff",
  padding: "8px 20px",
  borderRadius: "6px",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: "600" as const,
  marginTop: "12px",
  display: "inline-block" as const,
};
const jobDescription = {
  fontSize: "13px",
  color: "#64748b",
  margin: "8px 0 0",
  lineHeight: "1.5",
};
const keywordsSection = {
  padding: "12px 32px",
  backgroundColor: "#f8fafc",
  borderTop: "1px solid #e2e8f0",
};
const keywordsLabel = {
  fontSize: "12px",
  color: "#64748b",
  margin: "0",
  fontStyle: "italic" as const,
};
const hr = { borderColor: "#e2e8f0", margin: "0" };
const tipsSection = { padding: "20px 32px" };
const tipsTitle = {
  fontSize: "13px",
  fontWeight: "600" as const,
  color: "#64748b",
  margin: "0 0 6px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};
const tipsText = {
  fontSize: "13px",
  color: "#64748b",
  margin: "0",
  lineHeight: "1.5",
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
