import {
  Html,
  Head,
  Body,
  Container,
  Section,
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
  topJobs: { title: string; company: string; score: number }[];
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
      <Preview>Resume hebdomadaire - Semaine du {weekOf}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Resume hebdomadaire</Heading>
          <Text style={subtitle}>Semaine du {weekOf}</Text>
          <Hr style={hr} />
          <Section style={statsRow}>
            <Text style={stat}>{newJobsCount} nouvelles offres</Text>
            <Text style={stat}>{appliedCount} candidatures</Text>
            <Text style={stat}>{interviewCount} entrevues</Text>
            <Text style={stat}>Score moyen: {avgScore}%</Text>
          </Section>
          <Hr style={hr} />
          {topJobs.length > 0 && (
            <>
              <Heading as="h2" style={h2}>
                Top offres de la semaine
              </Heading>
              {topJobs.map((job, i) => (
                <Text key={i} style={jobLine}>
                  {job.title} @ {job.company} - {job.score}%
                </Text>
              ))}
            </>
          )}
          <Hr style={hr} />
          <Text style={footer}>
            JobPilot - Votre assistant de recherche d&apos;emploi
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklySummary;

const main = { backgroundColor: "#f6f9fc", fontFamily: "Arial, sans-serif" };
const container = {
  margin: "0 auto",
  padding: "20px",
  maxWidth: "580px",
  backgroundColor: "#ffffff",
};
const h1 = {
  color: "#1a1a2e",
  fontSize: "24px",
  fontWeight: "bold" as const,
  margin: "0 0 12px",
};
const h2 = {
  color: "#1a1a2e",
  fontSize: "18px",
  fontWeight: "bold" as const,
  margin: "16px 0 8px",
};
const subtitle = { color: "#6b7280", fontSize: "14px", margin: "0 0 20px" };
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
const statsRow = { padding: "0" };
const stat = { color: "#374151", fontSize: "15px", margin: "4px 0" };
const jobLine = { color: "#374151", fontSize: "14px", margin: "4px 0" };
const footer = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center" as const,
};
