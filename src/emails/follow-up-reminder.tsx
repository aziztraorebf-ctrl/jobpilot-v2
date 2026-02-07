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

interface StaleApplication {
  jobTitle: string;
  company: string;
  appliedDaysAgo: number;
  status: string;
}

interface FollowUpReminderProps {
  applications: StaleApplication[];
  date: string;
}

export function FollowUpReminder({
  applications,
  date,
}: FollowUpReminderProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{`${applications.length} candidature(s) a relancer`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Rappel de suivi</Heading>
          <Text style={subtitle}>
            {date} - Ces candidatures n&apos;ont pas eu de mise a jour
            recemment
          </Text>
          <Hr style={hr} />
          {applications.map((app, i) => (
            <Section key={i} style={appCard}>
              <Text style={appTitle}>{app.jobTitle}</Text>
              <Text style={appMeta}>
                {app.company} - {app.status} depuis {app.appliedDaysAgo} jours
              </Text>
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

export default FollowUpReminder;

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
const appCard = { padding: "8px 0" };
const appTitle = {
  fontSize: "15px",
  fontWeight: "600" as const,
  margin: "0 0 2px",
};
const appMeta = { color: "#6b7280", fontSize: "13px", margin: "0" };
const footer = {
  color: "#9ca3af",
  fontSize: "12px",
  textAlign: "center" as const,
};
