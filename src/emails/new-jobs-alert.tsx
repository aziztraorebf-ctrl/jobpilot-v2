import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Link,
  Preview,
} from "@react-email/components";

interface JobMatch {
  title: string;
  company: string;
  location: string | null;
  score: number;
  sourceUrl: string;
}

interface NewJobsAlertProps {
  jobs: JobMatch[];
  threshold: number;
  date: string;
}

export function NewJobsAlert({ jobs, threshold, date }: NewJobsAlertProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`${jobs.length} nouvelle(s) offre(s) au-dessus de ${threshold}%`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Nouvelles offres correspondantes</Heading>
          <Text style={subtitle}>
            {date} - {jobs.length} offre(s) avec un score &ge; {threshold}%
          </Text>
          <Hr style={hr} />
          {jobs.map((job, i) => (
            <Section key={i} style={jobCard}>
              <Text style={jobTitle}>
                <Link href={job.sourceUrl} style={link}>
                  {job.title}
                </Link>
              </Text>
              <Text style={jobMeta}>
                {job.company}
                {job.location ? ` - ${job.location}` : ""}
              </Text>
              <Text style={scoreBadge}>Score: {job.score}%</Text>
            </Section>
          ))}
          <Hr style={hr} />
          <Text style={footer}>
            JobPilot - Votre assistant de recherche d&apos;emploi
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default NewJobsAlert;

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
const subtitle = { color: "#6b7280", fontSize: "14px", margin: "0 0 20px" };
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
const jobCard = { padding: "12px 0" };
const jobTitle = {
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 4px",
};
const link = { color: "#2563eb", textDecoration: "none" };
const jobMeta = { color: "#6b7280", fontSize: "14px", margin: "0 0 4px" };
const scoreBadge = {
  color: "#059669",
  fontSize: "13px",
  fontWeight: "bold" as const,
  margin: "0",
};
const footer = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center" as const,
};
