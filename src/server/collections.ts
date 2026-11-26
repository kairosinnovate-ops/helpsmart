import "server-only";

/** Single source of truth for Firestore collection names. See docs/DATABASE_SCHEMA.md. */
export const C = {
  users: "users",
  publicProfiles: "publicProfiles",
  customerProfiles: "customerProfiles",
  providerProfiles: "providerProfiles",
  providerApplications: "providerApplications",
  professionalCredentials: "professionalCredentials",
  providerReferences: "providerReferences",
  privateIdentityRecords: "privateIdentityRecords",
  identityVerificationRecords: "identityVerificationRecords",
  identityVerificationSessions: "identityVerificationSessions",
  identitySubjects: "identitySubjects",
  verificationConsentRecords: "verificationConsentRecords",
  serviceCategories: "serviceCategories",
  geographicRegions: "geographicRegions",
  serviceRequests: "serviceRequests",
  quotations: "quotations",
  bookings: "bookings",
  bookingEvents: "events", // subcollection of bookings
  recurringBookings: "recurringBookings",
  savedProviders: "savedProviders",
  addresses: "addresses", // subcollection of users
  reviews: "reviews",
  reviewReports: "reviewReports",
  conversations: "conversations",
  messages: "messages", // subcollection of conversations
  userBlocks: "userBlocks",
  notifications: "notifications",
  payments: "payments",
  transactions: "transactions",
  supportTickets: "supportTickets",
  disputes: "disputes",
  incidentReports: "incidentReports",
  auditLogs: "auditLogs",
  platformSettings: "platformSettings",
  announcements: "announcements",
  rateLimits: "rateLimits",
  adminUsers: "adminUsers",
} as const;
