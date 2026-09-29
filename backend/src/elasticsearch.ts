import { Client } from "@elastic/elasticsearch";
import { config } from "./config.js";

export const esClient = new Client({ node: config.elasticsearchUrl });

export const EMAIL_INDEX = "email_jobs";

export async function ensureEmailIndex(): Promise<void> {
  const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
  if (exists) return;

  await esClient.indices.create({
    index: EMAIL_INDEX,
    settings: {
      analysis: {
        analyzer: {
          email_analyzer: {
            type: "custom",
            tokenizer: "standard",
            filter: ["lowercase", "asciifolding"],
          },
        },
      },
    },
    mappings: {
      properties: {
        id: { type: "keyword" },
        userId: { type: "keyword" },
        fromEmail: { type: "keyword" },
        toEmail: { type: "keyword" },
        toName: { type: "text", analyzer: "email_analyzer" },
        subject: { type: "text", analyzer: "email_analyzer" },
        bodyText: { type: "text", analyzer: "email_analyzer" },
        status: { type: "keyword" },
        scheduledAt: { type: "date" },
        sentAt: { type: "date" },
        createdAt: { type: "date" },
      },
    },
  });
}

export type EmailDocument = {
  id: string;
  userId: string;
  fromEmail: string;
  toEmail: string;
  toName?: string | null;
  subject: string;
  bodyText?: string | null;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
};

export async function indexEmail(doc: EmailDocument): Promise<void> {
  await esClient.index({
    index: EMAIL_INDEX,
    id: doc.id,
    document: doc,
    refresh: true,
  });
}

export async function searchEmails(params: {
  userId: string;
  query: string;
  limit?: number;
}): Promise<EmailDocument[]> {
  const q = params.query.trim();
  if (!q) return [];

  const result = await esClient.search<EmailDocument>({
    index: EMAIL_INDEX,
    size: params.limit ?? 50,
    query: {
      bool: {
        must: [
          { term: { userId: params.userId } },
          {
            multi_match: {
              query: q,
              fields: ["subject^3", "bodyText", "toName", "toEmail"],
              fuzziness: "AUTO",
            },
          },
        ],
      },
    },
    sort: [{ scheduledAt: "desc" }],
  });

  return result.hits.hits
    .map((h) => h._source)
    .filter((s): s is EmailDocument => !!s);
}
