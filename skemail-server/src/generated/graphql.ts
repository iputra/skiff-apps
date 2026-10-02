/* eslint-disable */
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Date: Date;
  JSON: unknown;
  PublicKey: { key: string; signature?: string | null };
  PublicKeyWithSignature: { key: string; signature: string };
  Upload: Promise<import("graphql-upload-minimal").FileUpload>;
  Void: null | undefined;
};

export type AcceptInviteStep2Request = {
  clientEphemeralPublic: Scalars['String'];
  clientSessionProof: Scalars['String'];
  docID: Scalars['String'];
  inviteID: Scalars['String'];
  newPermissionEntry: PermissionEntryInput;
  publicHierarchicalKey?: InputMaybe<Scalars['String']>;
  signature: Scalars['String'];
};

export type ActionType =
  | 'APPLY_LABEL'
  | 'APPLY_SYSTEM_LABEL'
  | 'DONT_NOTIFY'
  | 'MARK_AS_READ';

export type AddEmailRequest = {
  newEmail?: InputMaybe<Scalars['String']>;
  token?: InputMaybe<Scalars['String']>;
};

export type AddEmailResponse = {
  __typename?: 'AddEmailResponse';
  status: RequestStatus;
};

export type AddPendingInviteRequest = {
  docID: Scalars['String'];
  documentLink: Scalars['String'];
  email: Scalars['String'];
  permissionLevel: PermissionLevel;
};

export type AddPendingInviteResponse = {
  __typename?: 'AddPendingInviteResponse';
  status: RequestStatus;
};

export type AddressObject = {
  __typename?: 'AddressObject';
  address: Scalars['String'];
  blocked?: Maybe<Scalars['Boolean']>;
  name?: Maybe<Scalars['String']>;
};

export type AdjustBusinessPlanRequest = {
  requestedQuantity: Scalars['Int'];
};

export type AdjustBusinessPlanResponse = {
  __typename?: 'AdjustBusinessPlanResponse';
  seats?: Maybe<Scalars['Int']>;
  status: RequestStatus;
};

export type AliasDisplayInfo = {
  __typename?: 'AliasDisplayInfo';
  displayName?: Maybe<Scalars['String']>;
  displayPictureData?: Maybe<DisplayPictureDataSkemail>;
};

export type AliasesOnDomainResponse = {
  __typename?: 'AliasesOnDomainResponse';
  domainAliases: Array<DomainAliasData>;
};

export type AnonymousSubdomain = {
  __typename?: 'AnonymousSubdomain';
  domain: Scalars['String'];
  domainID: Scalars['String'];
};

export type AscDesc =
  | 'ASC'
  | 'DESC';

export type Attachment = {
  __typename?: 'Attachment';
  attachmentID: Scalars['String'];
  downloadLink: Scalars['String'];
  encryptedSessionKey: EncryptedSessionKeyOutput;
};

export type AuthAction =
  | 'AutoForward'
  | 'Import';

export type AutoReplyOutput = {
  __typename?: 'AutoReplyOutput';
  encryptedHtml: EncryptedDataOutput;
  encryptedSessionKey: EncryptedSessionKeyOutput;
  encryptedSubject: EncryptedDataOutput;
  encryptedText: EncryptedDataOutput;
  encryptedTextAsHtml: EncryptedDataOutput;
};

export type BulkActionJobStatusRequest = {
  bulkActionVariant: BulkActionVariant;
  jobID: Scalars['String'];
};

export type BulkActionVariant =
  | 'MODIFY_LABELS'
  | 'PERMANENTLY_DELETE';

export type BulkDeleteTrashedThreadsResponse = {
  __typename?: 'BulkDeleteTrashedThreadsResponse';
  jobID: Scalars['String'];
};

export type BulkModifyLabelsJobStatusResponse = {
  __typename?: 'BulkModifyLabelsJobStatusResponse';
  completed: Scalars['Boolean'];
  jobStatus: BullMqJobStatus;
};

export type BulkModifyLabelsRequest = {
  systemLabels?: InputMaybe<Array<SystemLabels>>;
  targetLabel: Scalars['String'];
  userLabels?: InputMaybe<Array<Scalars['String']>>;
};

export type BulkModifyLabelsResponse = {
  __typename?: 'BulkModifyLabelsResponse';
  jobID: Scalars['String'];
};

export type BulkSilenceSuggestions = {
  __typename?: 'BulkSilenceSuggestions';
  silenceSenderDomains: Array<SilencedDomainAggregation>;
  silenceSenderIndividuals: Array<SilenceSenderBulkSuggestion>;
};

export type BulkTrashRequest = {
  sender: Scalars['String'];
};

export type BulkTrashResponse = {
  __typename?: 'BulkTrashResponse';
  jobID: Scalars['String'];
};

export type BullMqJobStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'DELAYED'
  | 'FAILED'
  | 'PRIORITIZED'
  | 'UNKNOWN'
  | 'WAITING'
  | 'WAITING_CHILDREN';

export type CalendarView =
  | 'MONTHLY'
  | 'WEEKLY';

export type CheckIfDomainsAvailableResponse = {
  __typename?: 'CheckIfDomainsAvailableResponse';
  domains?: Maybe<Array<Domain>>;
};

export type CheckoutSession = {
  __typename?: 'CheckoutSession';
  downgradeProgress?: Maybe<DowngradeProgress>;
  status: RequestStatus;
  url?: Maybe<Scalars['String']>;
};

export type ClearSessionCacheResponse = {
  __typename?: 'ClearSessionCacheResponse';
  status: RequestStatus;
};

export type ConfirmCacheUploadRequest = {
  cacheID: Scalars['String'];
};

export type ConfirmCacheUploadResponse = {
  __typename?: 'ConfirmCacheUploadResponse';
  ipfsPath?: Maybe<Scalars['String']>;
  readUrl?: Maybe<Scalars['String']>;
};

export type Contact = {
  __typename?: 'Contact';
  contactID: Scalars['String'];
  displayPictureData?: Maybe<DisplayPictureDataSkemail>;
  emailAddress?: Maybe<Scalars['String']>;
  encryptedByKey?: Maybe<Scalars['String']>;
  encryptedContactData?: Maybe<Scalars['String']>;
  encryptedSessionKey?: Maybe<Scalars['String']>;
  firstName?: Maybe<Scalars['String']>;
  lastName?: Maybe<Scalars['String']>;
};

export type ContactPgpKeyRequest = {
  publicKey: Scalars['String'];
  trustLevel?: InputMaybe<PgpTrustLevel>;
};

export type CreateAnonymousSubdomainInput = {
  rootDomain: Scalars['String'];
  subDomain: Scalars['String'];
};

export type CreateBillingPortalSessionOutput = {
  __typename?: 'CreateBillingPortalSessionOutput';
  url?: Maybe<Scalars['String']>;
};

export type CreateCacheElementRequest = {
  dataSize: Scalars['Float'];
  docID: Scalars['String'];
  type: Scalars['String'];
};

export type CreateCacheElementResponse = {
  __typename?: 'CreateCacheElementResponse';
  cacheID: Scalars['String'];
  writeUrl: Scalars['String'];
};

export type CreateCustomDomainAliasRequest = {
  customDomain: Scalars['String'];
  emailAlias: Scalars['String'];
  userID?: InputMaybe<Scalars['String']>;
};

export type CreateCustomDomainAliasResponse = {
  __typename?: 'CreateCustomDomainAliasResponse';
  emailAliases: Array<Scalars['String']>;
};

export type CreateEmailAliasRequest = {
  customDomain?: InputMaybe<Scalars['String']>;
  emailAlias: Scalars['String'];
};

export type CreateEmailAliasResponse = {
  __typename?: 'CreateEmailAliasResponse';
  emailAliases: Array<Scalars['String']>;
};

export type CreateImportSessionRequest = {
  client: ImportClients;
  code: Scalars['String'];
  state: Scalars['String'];
};

export type CreateMailFilterInput = {
  actions: Array<FilterActionInput>;
  encryptedByKey: Scalars['String'];
  encryptedSessionKey: Scalars['String'];
  filter: MailFilterInput;
  name?: InputMaybe<Scalars['String']>;
};

/**
 * Note: Either contactID or emailAddress MUST be provided.
 * contactID for new version. emailAddress for old version.
 * empty string for contactID is acceptable and represents create contact on new version.
 */
export type CreateOrUpdateContactRequest = {
  contactID?: InputMaybe<Scalars['String']>;
  displayPictureData?: InputMaybe<UpdateDisplayPictureSkemailRequest>;
  emailAddress?: InputMaybe<Scalars['String']>;
  encryptedByKey?: InputMaybe<Scalars['String']>;
  encryptedContactData?: InputMaybe<Scalars['String']>;
  encryptedSessionKey?: InputMaybe<Scalars['String']>;
  firstName?: InputMaybe<Scalars['String']>;
  lastName?: InputMaybe<Scalars['String']>;
  pgpKey?: InputMaybe<ContactPgpKeyRequest>;
};

export type CreateOrUpdateDraftRequest = {
  draftID: Scalars['String'];
  encryptedDraft: Scalars['String'];
  encryptedKey: Scalars['String'];
};

export type CreateSrpRequest = {
  acceptInviteStep2Request?: InputMaybe<AcceptInviteStep2Request>;
  captchaToken: Scalars['String'];
  encryptedUserData: Scalars['String'];
  platformInfo?: InputMaybe<PlatformInfo>;
  publicKey: Scalars['PublicKey'];
  salt: Scalars['String'];
  signingPublicKey: Scalars['String'];
  skiffMailAlias?: InputMaybe<Scalars['String']>;
  udToken?: InputMaybe<Scalars['String']>;
  userAttributionData: UserAttributionInput;
  verifier: Scalars['String'];
};

export type CreateTeamRequest = {
  everyoneDocumentPermissionProxy: DocumentPermissionProxyInput;
  icon: Scalars['String'];
  name: Scalars['String'];
  orgID: Scalars['String'];
  rootDocument: NewDocRequest;
};

export type CreateUploadAvatarLinkResponse = {
  __typename?: 'CreateUploadAvatarLinkResponse';
  profileCustomURI: Scalars['String'];
  writeUrl: Scalars['String'];
};

/** Either contactID or contactEmail must be provided, but not both. */
export type CreateUploadContactAvatarLinkRequest = {
  contactEmail?: InputMaybe<Scalars['String']>;
  contactID?: InputMaybe<Scalars['String']>;
};

export type CreateUserLabelRequest = {
  color: Scalars['String'];
  labelName: Scalars['String'];
  variant: UserLabelVariant;
};

export type CreateWalletChallengeRequestSkemail = {
  walletAddress: Scalars['String'];
};

export type CreateWalletChallengeResponseSkemail = {
  __typename?: 'CreateWalletChallengeResponseSkemail';
  token: Scalars['String'];
};

export type CreditAmount = {
  __typename?: 'CreditAmount';
  cents: Scalars['Int'];
  editorStorageBytes: Scalars['String'];
  skemailStorageBytes: Scalars['String'];
};

export type CreditAmountInput = {
  cents: Scalars['Int'];
  editorStorageBytes: Scalars['String'];
  skemailStorageBytes: Scalars['String'];
};

export type CreditInfo =
  | 'CREDITS_FROM_ANDROID_APP'
  | 'CREDITS_FROM_GMAIL_IMPORT'
  | 'CREDITS_FROM_GOOGLE_DRIVE_IMPORTS'
  | 'CREDITS_FROM_IOS_APP'
  | 'CREDITS_FROM_MAC_APP'
  | 'CREDITS_FROM_OUTLOOK_IMPORT'
  | 'CREDITS_FROM_REFERRALS'
  | 'CURRENT_CREDITS'
  | 'TOTAL_CREDITS_EARNED';

export type CreditInfoResponse = {
  __typename?: 'CreditInfoResponse';
  amount: CreditAmount;
  count: Scalars['Int'];
  info: CreditInfo;
};

export type CreditTransactionReason =
  | 'ANDROID_APP'
  | 'ENS_NAME'
  | 'GMAIL_IMPORT'
  | 'GOOGLE_DRIVE_IMPORT'
  | 'IOS_APP'
  | 'MAC_APP'
  | 'MANUAL'
  | 'OUTLOOK_IMPORT'
  | 'REDEEMED_STRIPE_COUPON'
  | 'REFEREE'
  | 'REFERRAL'
  | 'REVERT_SKIFF_CREDIT_COUPON_PRORATION'
  | 'SKIFF_CREDIT_COUPON_PRORATION'
  | 'STRIPE_CREDIT'
  | 'STRIPE_DEBIT';

export type CustomDomainRecord = {
  __typename?: 'CustomDomainRecord';
  createdAt: Scalars['Date'];
  dnsRecords: Array<DnsRecord>;
  domain: Scalars['String'];
  domainID: Scalars['String'];
  skiffManaged: Scalars['Boolean'];
  verificationStatus: Scalars['String'];
};

export type CustomDomainSubscriptionInfo = {
  __typename?: 'CustomDomainSubscriptionInfo';
  cancelAtPeriodEnd: Scalars['Boolean'];
  domainID: Scalars['String'];
  supposedEndDate: Scalars['Date'];
};

export type DnsRecord = {
  __typename?: 'DNSRecord';
  data: Scalars['String'];
  error?: Maybe<DnsRecordStatusError>;
  name: Scalars['String'];
  type: DnsRecordType;
};

export type DnsRecordType =
  | 'CNAME'
  | 'MX'
  | 'TXT';

export type DefaultDisplayPictureData = {
  __typename?: 'DefaultDisplayPictureData';
  profilePictureData: Scalars['String'];
};

export type DeleteAccountRequest = {
  loginSrpRequest: LoginSrpRequest;
  signature: Scalars['String'];
};

export type DeleteAccountResponse = {
  __typename?: 'DeleteAccountResponse';
  status: RequestStatus;
};

export type DeleteContactRequest = {
  contactID?: InputMaybe<Scalars['String']>;
  emailAddress?: InputMaybe<Scalars['String']>;
};

export type DeleteContactsRequest = {
  contactIDs: Array<Scalars['String']>;
};

export type DeleteCustomDomainAliasRequest = {
  captchaToken?: InputMaybe<Scalars['String']>;
  emailAlias: Scalars['String'];
  userID?: InputMaybe<Scalars['String']>;
};

export type DeleteCustomDomainRequest = {
  domainID: Scalars['String'];
};

export type DeleteDraftRequest = {
  draftID: Scalars['String'];
};

export type DeleteInviteRequest = {
  docID: Scalars['String'];
  email: Scalars['String'];
};

export type DeleteInviteResponse = {
  __typename?: 'DeleteInviteResponse';
  status: RequestStatus;
};

export type DeleteMailAccountRequest = {
  signature: Scalars['String'];
};

export type DeleteMailAccountResponse = {
  __typename?: 'DeleteMailAccountResponse';
  status: RequestStatus;
};

export type DeleteMailFilterInput = {
  mailFilterID: Scalars['String'];
};

export type DeleteThreadRequest = {
  threadIDs: Array<Scalars['String']>;
};

export type DeleteUserLabelRequest = {
  labelID: Scalars['String'];
};

export type DeleteUserOrganizationMembershipRequest = {
  orgID: Scalars['String'];
  userID: Scalars['String'];
};

export type DisableEmailAutoForwardingRequest = {
  client: EmailAutoForwardingClient;
};

export type DisableMfaRequest = {
  credentialID?: InputMaybe<Scalars['String']>;
  disableTotp: Scalars['Boolean'];
  loginSrpRequest: LoginSrpRequest;
};

export type DisableMfaResponse = {
  __typename?: 'DisableMfaResponse';
  status: RequestStatus;
};

export type DisplayPictureData = {
  __typename?: 'DisplayPictureData';
  profileAccentColor?: Maybe<Scalars['String']>;
  profileCustomURI?: Maybe<Scalars['String']>;
  profileIcon?: Maybe<Scalars['String']>;
};

export type DisplayPictureDataSkemail = {
  __typename?: 'DisplayPictureDataSkemail';
  profileAccentColor?: Maybe<Scalars['String']>;
  profileCustomURI?: Maybe<Scalars['String']>;
  profileIcon?: Maybe<Scalars['String']>;
};

export type DnsRecordStatusError = {
  __typename?: 'DnsRecordStatusError';
  errorData?: Maybe<DnsRecordStatusErrorData>;
  errorType: Scalars['String'];
};

export type DnsRecordStatusErrorData = {
  __typename?: 'DnsRecordStatusErrorData';
  retrievedRecord?: Maybe<SingleRetrievedRecord>;
};

export type Document = {
  __typename?: 'Document';
  cloneDocID?: Maybe<Scalars['String']>;
  collaborators: Array<DocumentCollaborator>;
  contents: EncryptedContentsOutput;
  createdAt?: Maybe<Scalars['Date']>;
  currentUserPermissionLevel: PermissionLevel;
  docID: Scalars['String'];
  documentType: NwContentType;
  hasChildren: Scalars['Boolean'];
  hierarchicalPermissionChain: Array<HierarchicalPermissionChainLink>;
  invites: Array<PendingUserInvite>;
  link?: Maybe<LinkOutput>;
  metadata: EncryptedMetadataOutput;
  parentID?: Maybe<Scalars['String']>;
  parentKeysClaim?: Maybe<Scalars['String']>;
  parentPublicHierarchicalKey?: Maybe<Scalars['String']>;
  parentsBreadcrumb: Array<Document>;
  permissionProxies: Array<DocumentPermissionProxy>;
  previousParentID?: Maybe<Scalars['String']>;
  publicHierarchicalKey?: Maybe<Scalars['String']>;
  team?: Maybe<Team>;
  thumbnail?: Maybe<Scalars['String']>;
  trashedAt?: Maybe<Scalars['String']>;
  updatedAt?: Maybe<Scalars['Date']>;
};

export type DocumentCollaborator = {
  __typename?: 'DocumentCollaborator';
  expiryDate?: Maybe<Scalars['Date']>;
  permissionLevel: PermissionLevel;
  sourceDocID: Scalars['String'];
  user: User;
};

export type DocumentPermissionProxy = {
  __typename?: 'DocumentPermissionProxy';
  sourceDocID: Scalars['String'];
  sourceTeam: Team;
};

export type DocumentPermissionProxyInput = {
  sourceDocID: Scalars['String'];
  sourceDocPublicHierarchicalKey: Scalars['String'];
  sourceKeysClaim: Scalars['String'];
  sourceKeysClaimEncryptedByKey: Scalars['String'];
  targetDocID: Scalars['String'];
  targetDocPublicHierarchicalKey: Scalars['String'];
};

export type Domain = {
  __typename?: 'Domain';
  available: Scalars['Boolean'];
  currency?: Maybe<Scalars['String']>;
  domain: Scalars['String'];
  period?: Maybe<Scalars['Int']>;
  price?: Maybe<Scalars['Float']>;
};

export type DomainAliasData = {
  __typename?: 'DomainAliasData';
  displayEmailAlias: Scalars['String'];
  emailAlias?: Maybe<Scalars['String']>;
  isCatchall: Scalars['Boolean'];
};

export type DomainDetails = {
  __typename?: 'DomainDetails';
  expiresAt: Scalars['String'];
  renewAuto: Scalars['Boolean'];
  renewalDetails: RenewalDetails;
};

export type DowngradeProgress = {
  __typename?: 'DowngradeProgress';
  currentStorageInMb: Scalars['Int'];
  customDomains: Scalars['Int'];
  emailAliases: Scalars['Int'];
  quickAliasSubdomains: Scalars['Int'];
  quickAliases: Scalars['Int'];
  shortAliases: Scalars['Int'];
  userFolders: Scalars['Int'];
  userLabels: Scalars['Int'];
  userMailFilters: Scalars['Int'];
  workspaceUsers: Scalars['Int'];
};

export type Draft = {
  __typename?: 'Draft';
  draftID: Scalars['String'];
  encryptedDraft: Scalars['String'];
  encryptedKey: Scalars['String'];
  updatedAt?: Maybe<Scalars['Date']>;
};

export type EditOrganizationRequest = {
  displayPictureData?: InputMaybe<UpdateDisplayPictureRequest>;
  name?: InputMaybe<Scalars['String']>;
  orgID: Scalars['String'];
};

export type EditOrganizationResponse = {
  __typename?: 'EditOrganizationResponse';
  organization: Organization;
};

export type EditUserLabelRequest = {
  color?: InputMaybe<Scalars['String']>;
  labelID: Scalars['String'];
  labelName?: InputMaybe<Scalars['String']>;
  variant?: InputMaybe<UserLabelVariant>;
};

export type Email = {
  __typename?: 'Email';
  attachmentMetadata: Array<EncryptedAttachmentMetadata>;
  bcc: Array<AddressObject>;
  cc: Array<AddressObject>;
  createdAt: Scalars['Date'];
  encryptedHtml: EncryptedDataOutput;
  encryptedRawMimeUrl?: Maybe<Scalars['String']>;
  encryptedSessionKey: EncryptedSessionKeyOutput;
  encryptedSubject: EncryptedDataOutput;
  encryptedText: EncryptedDataOutput;
  encryptedTextAsHtml: EncryptedDataOutput;
  encryptedTextSnippet?: Maybe<EncryptedDataOutput>;
  from: AddressObject;
  id: Scalars['String'];
  notificationsTurnedOffForSender: Scalars['Boolean'];
  replyTo?: Maybe<AddressObject>;
  scheduleSendAt?: Maybe<Scalars['Date']>;
  to: Array<AddressObject>;
};

export type EmailAutoForwardingClient =
  | 'Gmail'
  | 'Outlook';

/** The user's email auto-forwarding settings for a given external email client. */
export type EmailAutoForwardingClientSettings = {
  __typename?: 'EmailAutoForwardingClientSettings';
  enabled: Scalars['Boolean'];
};

export type EmailAutoForwardingSettings = {
  __typename?: 'EmailAutoForwardingSettings';
  gmail: EmailAutoForwardingClientSettings;
  outlook: EmailAutoForwardingClientSettings;
};

export type EmailImportCustomDateRange = {
  end: Scalars['Date'];
  start: Scalars['Date'];
};

export type EmailImportDateRange = {
  clientTimeZone: Scalars['String'];
  customDateRange?: InputMaybe<EmailImportCustomDateRange>;
  rangeType: EmailImportDateRangeType;
};

export type EmailImportDateRangeType =
  | 'ALL'
  | 'CUSTOM'
  | 'LAST_1_MONTH'
  | 'LAST_3_MONTHS'
  | 'LAST_12_MONTHS';

export type EmailImportMeta = {
  __typename?: 'EmailImportMeta';
  estimatedEmailCount: Scalars['Int'];
};

export type EmailImportMetaRequest = {
  client: ImportClients;
  dateRange: EmailImportDateRange;
  importID: Scalars['String'];
};

export type EnableEmailAutoForwardingRequest = {
  client: EmailAutoForwardingClient;
  code: Scalars['String'];
  state: Scalars['String'];
};

export type EnableGmailImportRequest = {
  dateRange: EmailImportDateRange;
  importID: Scalars['String'];
  includeGmailLabelIDs?: InputMaybe<Array<Scalars['ID']>>;
  subscribeToAutoImport: Scalars['Boolean'];
};

export type EnableOutlookImportRequest = {
  dateRange: EmailImportDateRange;
  importID: Scalars['String'];
  includeOutlookCategoryIDs: Array<Scalars['ID']>;
  includeOutlookFolderIDs: Array<Scalars['ID']>;
  subscribeToAutoImport: Scalars['Boolean'];
};

export type EncryptedAttachmentInput = {
  encryptedContent: EncryptedFileInput;
  encryptedMetadata: EncryptedDataInput;
};

export type EncryptedAttachmentMetadata = {
  __typename?: 'EncryptedAttachmentMetadata';
  attachmentID: Scalars['String'];
  encryptedData: EncryptedDataOutput;
};

export type EncryptedChunk = {
  chunkNumber: Scalars['Int'];
  content: Scalars['String'];
  signature: Scalars['String'];
  signedBy: Scalars['String'];
};

export type EncryptedChunkOutput = {
  __typename?: 'EncryptedChunkOutput';
  chunkNumber: Scalars['Int'];
  content: Scalars['String'];
  signature: Scalars['String'];
  signedBy: Scalars['String'];
};

export type EncryptedContents = {
  contentsArr: Array<EncryptedChunk>;
};

export type EncryptedContentsOutput = {
  __typename?: 'EncryptedContentsOutput';
  contentsArr: Array<EncryptedChunkOutput>;
};

export type EncryptedDataInput = {
  encryptedData: Scalars['String'];
};

export type EncryptedDataOutput = {
  __typename?: 'EncryptedDataOutput';
  encryptedData: Scalars['String'];
};

export type EncryptedFileInput = {
  encryptedFile: Scalars['Upload'];
};

export type EncryptedMetadata = {
  encryptedMetadata: Scalars['String'];
  signature: Scalars['String'];
  signedBy: Scalars['String'];
};

export type EncryptedMetadataOutput = {
  __typename?: 'EncryptedMetadataOutput';
  encryptedMetadata: Scalars['String'];
  signature: Scalars['String'];
  signedBy: Scalars['String'];
};

export type EncryptedSessionKeyInput = {
  encryptedBy: Scalars['PublicKey'];
  encryptedSessionKey: Scalars['String'];
};

export type EncryptedSessionKeyOutput = {
  __typename?: 'EncryptedSessionKeyOutput';
  encryptedBy: Scalars['PublicKey'];
  encryptedSessionKey: Scalars['String'];
};

export type EnrollMfaRequest = {
  dataMFA: Scalars['String'];
  loginSrpRequest: LoginSrpRequest;
  signature: Scalars['String'];
};

export type EnrollMfaResponse = {
  __typename?: 'EnrollMfaResponse';
  backupCodes: Array<Scalars['String']>;
  status: RequestStatus;
};

export type EntityType =
  | 'ORG'
  | 'USER';

export type ExternalEmailClientLabel = {
  labelID: Scalars['ID'];
  labelName: Scalars['String'];
};

export type ExternalEmailClientSystemLabel = ExternalEmailClientLabel & {
  __typename?: 'ExternalEmailClientSystemLabel';
  labelID: Scalars['ID'];
  labelName: Scalars['String'];
  /** The corresponding Skiff system label (if one exists). */
  skiffSystemLabel?: Maybe<SystemLabels>;
};

export type ExternalEmailClientUserLabel = ExternalEmailClientLabel & {
  __typename?: 'ExternalEmailClientUserLabel';
  labelID: Scalars['ID'];
  labelName: Scalars['String'];
  /**
   * The corresponding Skiff user label (if this label corresponds to one of the
   * user's existing labels in Skiff).
   */
  skiffUserLabel?: Maybe<UserLabel>;
};

export type FeedbackCategoryEnum =
  | 'BILLING'
  | 'BUG'
  | 'QUESTION'
  | 'REQUEST';

export type FileTableDisplayFormat =
  | 'GRID'
  | 'LIST';

export type FilterAction = {
  __typename?: 'FilterAction';
  actionType: ActionType;
  serializedData?: Maybe<Scalars['String']>;
};

export type FilterActionInput = {
  actionType: ActionType;
  serializedData?: InputMaybe<Scalars['String']>;
};

export type FilterField =
  | 'CONTAINS';

export type FilterType =
  | 'AND'
  | 'BCC'
  | 'BODY'
  | 'CC'
  | 'FROM'
  | 'NOT'
  | 'OR'
  | 'RECIPIENT'
  | 'SUBJECT'
  | 'TO';

export type FilteredThreadIDs = {
  __typename?: 'FilteredThreadIDs';
  numThreadIDsRemoved: Scalars['Int'];
  threadIDs: Array<Scalars['String']>;
};

export type FilteredThreadIDsRequest = {
  systemLabels?: InputMaybe<Array<SystemLabels>>;
  threadIDs: Array<Scalars['String']>;
  userLabelIDs?: InputMaybe<Array<Scalars['String']>>;
};

export type FullAliasInfo = {
  __typename?: 'FullAliasInfo';
  areNotificationsEnabled?: Maybe<Scalars['Boolean']>;
  createdAt: Scalars['Date'];
  displayName?: Maybe<Scalars['String']>;
  displayPictureData?: Maybe<DisplayPictureDataSkemail>;
  emailAlias: Scalars['String'];
  encryptedAliasData?: Maybe<Scalars['String']>;
  encryptedByKey?: Maybe<Scalars['String']>;
  encryptedSessionKey?: Maybe<Scalars['String']>;
};

export type GenerateCustomDomainRecordsRequest = {
  domain: Scalars['String'];
};

export type GenerateCustomDomainRecordsResponse = {
  __typename?: 'GenerateCustomDomainRecordsResponse';
  dkimRecords: Array<DnsRecord>;
  dmarcRecord: DnsRecord;
  domainID: Scalars['String'];
  mxRecords: Array<DnsRecord>;
  spfRecords: DnsRecord;
};

export type GenerateWebAuthnChallengeResponse = {
  __typename?: 'GenerateWebAuthnChallengeResponse';
  options: Scalars['JSON'];
};

export type GenerateWebAuthnRegistrationResponse = {
  __typename?: 'GenerateWebAuthnRegistrationResponse';
  options: Scalars['JSON'];
};

export type GetAliasValidRequest = {
  alias: Scalars['String'];
};

export type GetBillingPortalSessionRequest = {
  redirectURL?: InputMaybe<Scalars['String']>;
};

export type GetCheckoutSessionRequest = {
  interval: SubscriptionInterval;
  redirectURL?: InputMaybe<Scalars['String']>;
  subscriptionPlan: SubscriptionPlan;
};

export type GetCoinbaseCheckoutIdRequest = {
  plan: SubscriptionPlan;
};

export type GetCoinbaseCheckoutIdResponse = {
  __typename?: 'GetCoinbaseCheckoutIDResponse';
  coinbaseCheckoutID: Scalars['String'];
};

export type GetContactsRequest = {
  emailAddresses: Array<Scalars['String']>;
};

export type GetCreditsRequest = {
  entityID: Scalars['String'];
  entityType: EntityType;
  include: Array<CreditInfo>;
};

export type GetCreditsResponse = {
  __typename?: 'GetCreditsResponse';
  credits: Array<CreditInfoResponse>;
};

export type GetCurrentUserCustomDomainsResponse = {
  __typename?: 'GetCurrentUserCustomDomainsResponse';
  domains: Array<CustomDomainRecord>;
};

export type GetCustomDomainCheckoutSessionRequest = {
  customDomain: Scalars['String'];
  redirectURL?: InputMaybe<Scalars['String']>;
};

export type GetDefaultProfilePictureRequest = {
  messageID: Scalars['String'];
};

export type GetDocumentRequest = {
  docID: Scalars['String'];
};

export type GetDocumentsRequest = {
  activeProductApp: ProductApp;
  docIDs?: InputMaybe<Array<Scalars['String']>>;
  manuallySharedOnRootDocumentsOfOrgRootDocumentID?: InputMaybe<Scalars['String']>;
  parentID?: InputMaybe<Scalars['String']>;
  personalRootDocuments?: InputMaybe<Scalars['Boolean']>;
  sharedOnRootDocuments?: InputMaybe<Scalars['Boolean']>;
  trashedChildren?: InputMaybe<Scalars['Boolean']>;
};

export type GetDomainSuggestionsResponse = {
  __typename?: 'GetDomainSuggestionsResponse';
  domains?: Maybe<Array<Scalars['String']>>;
};

export type GetMailFiltersInput = {
  clientside?: InputMaybe<Scalars['Boolean']>;
};

export type GetMboxImportUrlRequest = {
  fileSizeInBytes: Scalars['Int'];
};

export type GetMboxImportUrlResponse = {
  __typename?: 'GetMboxImportUrlResponse';
  fileID: Scalars['String'];
  uploadData: Scalars['String'];
};

export type GetSearchIndexProgressRequest = {
  newestThreadUpdatedAtInIndex: Scalars['Date'];
  oldestThreadUpdatedAtInIndex: Scalars['Date'];
};

export type GetUserRequest = {
  challengeJwt?: InputMaybe<Scalars['String']>;
  challengeSignature?: InputMaybe<Scalars['String']>;
  emailPasscode?: InputMaybe<Scalars['String']>;
  isNotLoggedIn?: InputMaybe<Scalars['Boolean']>;
  paperShareHash?: InputMaybe<Scalars['String']>;
  userID?: InputMaybe<Scalars['String']>;
  username?: InputMaybe<Scalars['String']>;
};

export type GetUsersRequest = {
  userIDs: Array<Scalars['String']>;
};

export type GmailInboxOrganization = {
  __typename?: 'GmailInboxOrganization';
  labels: Array<ExternalEmailClientLabel>;
};

export type GmailInboxOrganizationRequest = {
  importID: Scalars['String'];
};

export type GrantCreditsRequest = {
  creditAmount: CreditAmountInput;
  creditTransactionReason: CreditTransactionReason;
};

export type GrantCreditsResponse = {
  __typename?: 'GrantCreditsResponse';
  creditsGranted: CreditAmount;
  remainingCreditsToEarnForReason: CreditAmount;
};

export type HierarchicalPermissionChainLink = {
  __typename?: 'HierarchicalPermissionChainLink';
  docID: Scalars['String'];
  encryptedSessionKey?: Maybe<Scalars['String']>;
  encryptedSessionKeyEncryptedByKey?: Maybe<Scalars['String']>;
  keysClaim?: Maybe<Scalars['String']>;
  keysClaimEncryptedByKey?: Maybe<Scalars['String']>;
  permission?: Maybe<PermissionEntry>;
  previousLinkDocID?: Maybe<Scalars['String']>;
};

export type ImportClients =
  | 'Gmail'
  | 'Mbox'
  | 'Outlook';

export type ImportEmlEmailRequest = {
  emlFiles: Array<Scalars['Upload']>;
  role?: InputMaybe<Role>;
};

export type ImportMboxRequest = {
  fileID: Scalars['String'];
};

export type ImportSession = {
  __typename?: 'ImportSession';
  importID: Scalars['String'];
};

export type ImportStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'IN_PROGRESS'
  | 'SILENCING_SUGGESTIONS_GENERATED'
  | 'SILENCING_SUGGESTIONS_QUERYING'
  | 'SILENCING_SUGGESTIONS_QUERY_FAILED';

export type ImportStatusType = {
  __typename?: 'ImportStatusType';
  importID: Scalars['String'];
  importedEmailCount?: Maybe<Scalars['Int']>;
  status: ImportStatus;
};

export type Invoice = {
  __typename?: 'Invoice';
  amountDue?: Maybe<Scalars['Int']>;
  created?: Maybe<Scalars['Date']>;
  invoiceTiers?: Maybe<Array<Scalars['String']>>;
  status?: Maybe<Scalars['String']>;
  url?: Maybe<Scalars['String']>;
};

export type InvoiceHistory = {
  __typename?: 'InvoiceHistory';
  invoiceHistory?: Maybe<Array<Maybe<Invoice>>>;
};

export type LabelUnreadCount = {
  __typename?: 'LabelUnreadCount';
  count: Scalars['Int'];
  label: Scalars['String'];
};

export type LastViewedReferralCreditResponse = {
  __typename?: 'LastViewedReferralCreditResponse';
  amount: CreditAmount;
  count: Scalars['Int'];
};

export type LinkOutput = {
  __typename?: 'LinkOutput';
  encryptedLinkKey: Scalars['String'];
  permissionLevel: PermissionLevel;
  salt: Scalars['String'];
};

export type LoginMutationStatus =
  | 'AUTHENTICATED'
  | 'AUTH_FAILURE'
  | 'CHANGE_TEMPORARY_PASSWORD'
  | 'CREATED'
  | 'INVALID_JWT'
  | 'REJECTED'
  | 'TOKEN_NEEDED'
  | 'UPDATED'
  | 'USERNAME_INVALID'
  | 'WEBAUTHN_TOKEN_NEEDED';

export type LoginSrpRequest = {
  captchaToken?: InputMaybe<Scalars['String']>;
  clientEphemeralPublic?: InputMaybe<Scalars['String']>;
  clientSessionProof?: InputMaybe<Scalars['String']>;
  platformInfo?: InputMaybe<PlatformInfo>;
  step: Scalars['Int'];
  tokenMFA?: InputMaybe<Scalars['String']>;
  username: Scalars['String'];
  verifyWebAuthnData?: InputMaybe<Scalars['JSON']>;
};

export type LoginSrpResponse = {
  __typename?: 'LoginSrpResponse';
  cacheKey?: Maybe<Scalars['String']>;
  encryptedDocumentData?: Maybe<Scalars['String']>;
  encryptedMetamaskSecret?: Maybe<Scalars['String']>;
  encryptedUserData?: Maybe<Scalars['String']>;
  jwt?: Maybe<Scalars['String']>;
  mfaTypes?: Maybe<Array<Scalars['String']>>;
  publicData?: Maybe<PublicData>;
  publicKey?: Maybe<Scalars['PublicKey']>;
  recoveryEmail?: Maybe<Scalars['String']>;
  rootOrgID?: Maybe<Scalars['String']>;
  salt?: Maybe<Scalars['String']>;
  serverEphemeralPublic?: Maybe<Scalars['String']>;
  serverSessionProof?: Maybe<Scalars['String']>;
  signingPublicKey?: Maybe<Scalars['String']>;
  status?: Maybe<LoginMutationStatus>;
  unverifiedRecoveryEmail?: Maybe<Scalars['String']>;
  userID?: Maybe<Scalars['String']>;
  walletAddress?: Maybe<Scalars['String']>;
  webAuthnChallengeResponse?: Maybe<GenerateWebAuthnChallengeResponse>;
};

export type MfaFactors = {
  __typename?: 'MFAFactors';
  backupCodes?: Maybe<Array<Scalars['String']>>;
  totpData?: Maybe<Scalars['String']>;
  webAuthnKeys?: Maybe<Array<WebAuthnKey>>;
};

export type MailFilter = {
  __typename?: 'MailFilter';
  actions: Array<FilterAction>;
  clientside: Scalars['Boolean'];
  encryptedByKey?: Maybe<Scalars['String']>;
  encryptedSessionKey?: Maybe<Scalars['String']>;
  filter: MailFilterField;
  mailFilterID: Scalars['String'];
  name?: Maybe<Scalars['String']>;
};

export type MailFilterField = {
  __typename?: 'MailFilterField';
  filterField?: Maybe<FilterField>;
  filterType: FilterType;
  serializedData?: Maybe<Scalars['String']>;
  subFilter?: Maybe<Array<MailFilterField>>;
};

export type MailFilterInput = {
  filterField?: InputMaybe<FilterField>;
  filterType: FilterType;
  serializedData?: InputMaybe<Scalars['String']>;
  subFilter?: InputMaybe<Array<MailFilterInput>>;
};

export type Mailbox = {
  __typename?: 'Mailbox';
  pageInfo: MailboxPageInfo;
  threads: Array<UserThread>;
};

export type MailboxCursor = {
  date: Scalars['Date'];
  threadID: Scalars['String'];
};

export type MailboxCursorResponse = {
  __typename?: 'MailboxCursorResponse';
  date: Scalars['Date'];
  threadID: Scalars['String'];
};

export type MailboxFilters = {
  attachments?: InputMaybe<Scalars['Boolean']>;
  read?: InputMaybe<Scalars['Boolean']>;
};

export type MailboxPageInfo = {
  __typename?: 'MailboxPageInfo';
  cursor?: Maybe<MailboxCursorResponse>;
  hasNextPage: Scalars['Boolean'];
};

export type MailboxRequest = {
  clientsideFiltersApplied?: InputMaybe<Scalars['Boolean']>;
  cursor?: InputMaybe<MailboxCursor>;
  emailsUpdatedAfterDate?: InputMaybe<Scalars['Date']>;
  emailsUpdatedBeforeDate?: InputMaybe<Scalars['Date']>;
  filters?: InputMaybe<MailboxFilters>;
  isAliasInbox?: InputMaybe<Scalars['Boolean']>;
  label?: InputMaybe<Scalars['String']>;
  lastUpdatedDate?: InputMaybe<Scalars['Date']>;
  limit?: InputMaybe<Scalars['Int']>;
  noExcludedLabel?: InputMaybe<Scalars['Boolean']>;
  platformInfo?: InputMaybe<PlatformInfo>;
  polling?: InputMaybe<Scalars['Boolean']>;
  refetching?: InputMaybe<Scalars['Boolean']>;
  updatedAtField?: InputMaybe<UpdatedAtField>;
  updatedAtOrderDirection?: InputMaybe<AscDesc>;
  useUpdatedAtField?: InputMaybe<Scalars['Boolean']>;
  userLabels?: InputMaybe<Array<Scalars['String']>>;
};

export type MarkNotSpamMultipleEmailAddressesRequest = {
  emailAddressesToMarkNotSpam: Array<Scalars['String']>;
};

export type MarkSpamMultipleEmailAddressesRequest = {
  emailAddressesToMarkSpam: Array<Scalars['String']>;
};

export type MarkThreadAsOpenedInput = {
  threadID: Scalars['String'];
};

export type MarkThreadsAsClientsideFilteredInput = {
  threadIDs: Array<Scalars['String']>;
};

export type ModifyLabelsRequest = {
  systemLabels?: InputMaybe<Array<SystemLabels>>;
  threadIDs: Array<Scalars['String']>;
  userLabels?: InputMaybe<Array<Scalars['String']>>;
};

export type ModifyLabelsResponse = {
  __typename?: 'ModifyLabelsResponse';
  updatedThreads: Array<UpdatedThreadLabels>;
};

export type Mutation = {
  __typename?: 'Mutation';
  addEmail: AddEmailResponse;
  addPendingInvite: AddPendingInviteResponse;
  adjustBusinessPlan: AdjustBusinessPlanResponse;
  applyLabels?: Maybe<ModifyLabelsResponse>;
  bulkApplyLabels?: Maybe<BulkModifyLabelsResponse>;
  bulkDeleteTrashedThreads?: Maybe<BulkDeleteTrashedThreadsResponse>;
  bulkRemoveLabels?: Maybe<BulkModifyLabelsResponse>;
  bulkTrash?: Maybe<BulkTrashResponse>;
  clearSessionCache: ClearSessionCacheResponse;
  confirmCacheUpload: ConfirmCacheUploadResponse;
  createAnonymousSubdomain?: Maybe<Scalars['Void']>;
  createCacheElement: CreateCacheElementResponse;
  createCustomDomainAlias?: Maybe<CreateCustomDomainAliasResponse>;
  createEmailAlias?: Maybe<CreateEmailAliasResponse>;
  createImportSession: ImportSession;
  createMailFilter?: Maybe<Scalars['Void']>;
  createOrUpdateContact?: Maybe<Scalars['Void']>;
  createOrUpdateDraft?: Maybe<Scalars['Void']>;
  createOrgUploadAvatarLink: CreateUploadAvatarLinkResponse;
  createTeam: Team;
  createUploadAliasAvatarLink: CreateUploadAvatarLinkResponse;
  createUploadAvatarLink: CreateUploadAvatarLinkResponse;
  createUploadContactAvatarLink: CreateUploadAvatarLinkResponse;
  createUserLabel?: Maybe<UserLabel>;
  createWalletChallengeSkemail: CreateWalletChallengeResponseSkemail;
  deleteAccount: DeleteAccountResponse;
  deleteAnonymousSubdomain?: Maybe<Scalars['Void']>;
  deleteAutoReply?: Maybe<Scalars['Void']>;
  deleteContact?: Maybe<Scalars['Void']>;
  deleteContacts?: Maybe<Scalars['Void']>;
  deleteCustomDomain?: Maybe<Scalars['Void']>;
  deleteCustomDomainAlias?: Maybe<Scalars['Void']>;
  deleteDraft?: Maybe<Scalars['Void']>;
  deleteInvite: DeleteInviteResponse;
  deleteMailAccount: DeleteMailAccountResponse;
  deleteMailFilter?: Maybe<Scalars['Void']>;
  deleteRecoveryEmail: Scalars['Boolean'];
  deleteThread?: Maybe<Scalars['Void']>;
  deleteUserLabel?: Maybe<Scalars['Void']>;
  deleteUserOrganizationMembership: Scalars['Boolean'];
  deleteUserSignature?: Maybe<Scalars['Void']>;
  disableEmailAutoForwarding?: Maybe<Scalars['Void']>;
  disableMfa: DisableMfaResponse;
  editOrganization: EditOrganizationResponse;
  editUserLabel?: Maybe<UserLabel>;
  enableEmailAutoForwarding?: Maybe<Scalars['Void']>;
  enableGmailImport?: Maybe<Scalars['Void']>;
  enableOutlookImport?: Maybe<Scalars['Void']>;
  enrollMfa: EnrollMfaResponse;
  generateCustomDomainRecords: GenerateCustomDomainRecordsResponse;
  generateWebAuthnRegistration: GenerateWebAuthnRegistrationResponse;
  getMboxImportUrl?: Maybe<GetMboxImportUrlResponse>;
  grantCredits: GrantCreditsResponse;
  importEmlEmail?: Maybe<Scalars['Void']>;
  importMboxEmails?: Maybe<Scalars['Void']>;
  loginSrp: LoginSrpResponse;
  markNotSpamMultipleEmailAddresses?: Maybe<Scalars['Void']>;
  markSpamMultipleEmailAddresses?: Maybe<Scalars['Void']>;
  markThreadAsOpened?: Maybe<Scalars['Void']>;
  markThreadsAsClientsideFiltered?: Maybe<Scalars['Void']>;
  muteNotificationForSender?: Maybe<Scalars['Void']>;
  provisionSrp: Scalars['Boolean'];
  referUser: ReferUserResponse;
  regenerateMfaBackupCodes: RegenerateMfaBackupCodesResponse;
  removeLabels?: Maybe<ModifyLabelsResponse>;
  renameWebAuthnDevice?: Maybe<Scalars['Void']>;
  replyToMessage?: Maybe<ReplyToEmailResponse>;
  saveCustomDomainRecords?: Maybe<Scalars['Void']>;
  saveThumbnail: SaveThumbnailResponse;
  sendAnonymousSubdomainTutorialEmail?: Maybe<Scalars['Void']>;
  sendFeedback: Scalars['Boolean'];
  sendMessage?: Maybe<SendEmailResponse>;
  setAllThreadsReadStatus: Scalars['Boolean'];
  setAutoReply?: Maybe<Scalars['Void']>;
  setAutoSyncContactsSetting?: Maybe<Scalars['Void']>;
  setCatchallAddress: Scalars['Boolean'];
  setDefaultEmailAlias: Scalars['Boolean'];
  setLastViewedReferralCredit: Scalars['Boolean'];
  setNotificationPreferences?: Maybe<Scalars['Boolean']>;
  setPDSubscribeFlag?: Maybe<Scalars['Void']>;
  setPGPKey?: Maybe<Scalars['Void']>;
  setPushToken?: Maybe<Scalars['Void']>;
  setReadStatus?: Maybe<SetReadStatusResponse>;
  setUserPreferences?: Maybe<UserPreferences>;
  setUserPublicKey?: Maybe<Scalars['Void']>;
  setUserSignature?: Maybe<Scalars['Void']>;
  setupLink: SetupLinkResponse;
  shareDoc: ShareDocResponse;
  shareTeamDocWithOtherTeam: Team;
  silenceMultipleEmailAddresses?: Maybe<Scalars['Void']>;
  storeWorkspaceEvent: Scalars['Boolean'];
  subscribeNotification?: Maybe<Scalars['Void']>;
  unblockEmailAddress?: Maybe<Scalars['Void']>;
  unmuteNotificationForSender?: Maybe<Scalars['Void']>;
  unsendMessage?: Maybe<Email>;
  unsilenceMultipleEmailAddresses?: Maybe<Scalars['Void']>;
  unsubscribeNotification?: Maybe<Scalars['Void']>;
  updateDisplayName: UpdateDisplayNameResponse;
  updateDisplayPicture: User;
  updateDocumentData: UpdateDocumentDataResponse;
  updateEmailAliasActiveState?: Maybe<UpdateEmailAliasActiveStateResponse>;
  updateEmailAliasProfile: Scalars['Boolean'];
  updateEmailAliasSendReceiveEnabledState?: Maybe<Scalars['Void']>;
  updateMailFilter?: Maybe<Scalars['Void']>;
  updateQuickAliasActiveState?: Maybe<UpdateQuickAliasActiveStateResponse>;
  updateQuickAliasInfo?: Maybe<Scalars['Void']>;
  updateSrp: UpdateSrpResponse;
  upgradeHierarchicalKeys: UpgradeHierarchicalKeysResponse;
  upgradeKey: UpgradeKeyResponse;
  uploadRecoveryData: UploadRecoveryDataResponse;
  uploadSpamReport?: Maybe<Scalars['Void']>;
  verifyCustomDomain?: Maybe<Scalars['Void']>;
  verifyWalletAddressCreateAlias: CreateEmailAliasResponse;
  verifyWebAuthnRegistration: VerifyWebAuthnRegistrationResponse;
};


export type MutationAddEmailArgs = {
  request: AddEmailRequest;
};


export type MutationAddPendingInviteArgs = {
  request: AddPendingInviteRequest;
};


export type MutationAdjustBusinessPlanArgs = {
  request: AdjustBusinessPlanRequest;
};


export type MutationApplyLabelsArgs = {
  request?: InputMaybe<ModifyLabelsRequest>;
};


export type MutationBulkApplyLabelsArgs = {
  request?: InputMaybe<BulkModifyLabelsRequest>;
};


export type MutationBulkRemoveLabelsArgs = {
  request?: InputMaybe<BulkModifyLabelsRequest>;
};


export type MutationBulkTrashArgs = {
  request: BulkTrashRequest;
};


export type MutationConfirmCacheUploadArgs = {
  request: ConfirmCacheUploadRequest;
};


export type MutationCreateAnonymousSubdomainArgs = {
  request: CreateAnonymousSubdomainInput;
};


export type MutationCreateCacheElementArgs = {
  request: CreateCacheElementRequest;
};


export type MutationCreateCustomDomainAliasArgs = {
  request?: InputMaybe<CreateCustomDomainAliasRequest>;
};


export type MutationCreateEmailAliasArgs = {
  request?: InputMaybe<CreateEmailAliasRequest>;
};


export type MutationCreateImportSessionArgs = {
  request: CreateImportSessionRequest;
};


export type MutationCreateMailFilterArgs = {
  input: CreateMailFilterInput;
};


export type MutationCreateOrUpdateContactArgs = {
  request: CreateOrUpdateContactRequest;
};


export type MutationCreateOrUpdateDraftArgs = {
  request: CreateOrUpdateDraftRequest;
};


export type MutationCreateTeamArgs = {
  request: CreateTeamRequest;
};


export type MutationCreateUploadAliasAvatarLinkArgs = {
  emailAlias: Scalars['String'];
};


export type MutationCreateUploadContactAvatarLinkArgs = {
  request: CreateUploadContactAvatarLinkRequest;
};


export type MutationCreateUserLabelArgs = {
  request?: InputMaybe<CreateUserLabelRequest>;
};


export type MutationCreateWalletChallengeSkemailArgs = {
  request: CreateWalletChallengeRequestSkemail;
};


export type MutationDeleteAccountArgs = {
  request: DeleteAccountRequest;
};


export type MutationDeleteAnonymousSubdomainArgs = {
  userDomainID: Scalars['String'];
};


export type MutationDeleteContactArgs = {
  request: DeleteContactRequest;
};


export type MutationDeleteContactsArgs = {
  request: DeleteContactsRequest;
};


export type MutationDeleteCustomDomainArgs = {
  request: DeleteCustomDomainRequest;
};


export type MutationDeleteCustomDomainAliasArgs = {
  request?: InputMaybe<DeleteCustomDomainAliasRequest>;
};


export type MutationDeleteDraftArgs = {
  request: DeleteDraftRequest;
};


export type MutationDeleteInviteArgs = {
  request: DeleteInviteRequest;
};


export type MutationDeleteMailAccountArgs = {
  deleteRequest: DeleteMailAccountRequest;
};


export type MutationDeleteMailFilterArgs = {
  input: DeleteMailFilterInput;
};


export type MutationDeleteThreadArgs = {
  request?: InputMaybe<DeleteThreadRequest>;
};


export type MutationDeleteUserLabelArgs = {
  request?: InputMaybe<DeleteUserLabelRequest>;
};


export type MutationDeleteUserOrganizationMembershipArgs = {
  request: DeleteUserOrganizationMembershipRequest;
};


export type MutationDisableEmailAutoForwardingArgs = {
  request: DisableEmailAutoForwardingRequest;
};


export type MutationDisableMfaArgs = {
  request: DisableMfaRequest;
};


export type MutationEditOrganizationArgs = {
  request: EditOrganizationRequest;
};


export type MutationEditUserLabelArgs = {
  request?: InputMaybe<EditUserLabelRequest>;
};


export type MutationEnableEmailAutoForwardingArgs = {
  request: EnableEmailAutoForwardingRequest;
};


export type MutationEnableGmailImportArgs = {
  request: EnableGmailImportRequest;
};


export type MutationEnableOutlookImportArgs = {
  request: EnableOutlookImportRequest;
};


export type MutationEnrollMfaArgs = {
  request: EnrollMfaRequest;
};


export type MutationGenerateCustomDomainRecordsArgs = {
  request: GenerateCustomDomainRecordsRequest;
};


export type MutationGetMboxImportUrlArgs = {
  getImportUrlRequest: GetMboxImportUrlRequest;
};


export type MutationGrantCreditsArgs = {
  request: GrantCreditsRequest;
};


export type MutationImportEmlEmailArgs = {
  importRequest: ImportEmlEmailRequest;
};


export type MutationImportMboxEmailsArgs = {
  importMboxRequest: ImportMboxRequest;
};


export type MutationLoginSrpArgs = {
  request: LoginSrpRequest;
};


export type MutationMarkNotSpamMultipleEmailAddressesArgs = {
  request?: InputMaybe<MarkNotSpamMultipleEmailAddressesRequest>;
};


export type MutationMarkSpamMultipleEmailAddressesArgs = {
  request?: InputMaybe<MarkSpamMultipleEmailAddressesRequest>;
};


export type MutationMarkThreadAsOpenedArgs = {
  request: MarkThreadAsOpenedInput;
};


export type MutationMarkThreadsAsClientsideFilteredArgs = {
  input: MarkThreadsAsClientsideFilteredInput;
};


export type MutationMuteNotificationForSenderArgs = {
  request: MuteNotificationForSenderRequest;
};


export type MutationProvisionSrpArgs = {
  request: ProvisionSrpRequest;
};


export type MutationReferUserArgs = {
  request: ReferUserRequest;
};


export type MutationRegenerateMfaBackupCodesArgs = {
  request: RegenerateMfaBackupCodesRequest;
};


export type MutationRemoveLabelsArgs = {
  request?: InputMaybe<ModifyLabelsRequest>;
};


export type MutationRenameWebAuthnDeviceArgs = {
  request: RenameWebAuthnDeviceRequest;
};


export type MutationReplyToMessageArgs = {
  message?: InputMaybe<ReplyToEmailRequest>;
};


export type MutationSaveCustomDomainRecordsArgs = {
  request: SaveCustomDomainRequest;
};


export type MutationSaveThumbnailArgs = {
  request: SaveThumbnailRequest;
};


export type MutationSendAnonymousSubdomainTutorialEmailArgs = {
  email: Scalars['String'];
};


export type MutationSendFeedbackArgs = {
  request: SendFeedbackRequest;
};


export type MutationSendMessageArgs = {
  message?: InputMaybe<SendEmailRequest>;
};


export type MutationSetAllThreadsReadStatusArgs = {
  request: SetAllThreadsReadStatusRequest;
};


export type MutationSetAutoReplyArgs = {
  request?: InputMaybe<SetAutoReplyRequest>;
};


export type MutationSetAutoSyncContactsSettingArgs = {
  value: Scalars['Boolean'];
};


export type MutationSetCatchallAddressArgs = {
  request: SetCatchallAddressRequest;
};


export type MutationSetDefaultEmailAliasArgs = {
  request?: InputMaybe<SetDefaultEmailAliasRequest>;
};


export type MutationSetLastViewedReferralCreditArgs = {
  request: SetLastViewedReferralCreditRequest;
};


export type MutationSetNotificationPreferencesArgs = {
  request: SetNotificationPreferencesRequest;
};


export type MutationSetPdSubscribeFlagArgs = {
  request?: InputMaybe<SetPdSubscribeFlagRequest>;
};


export type MutationSetPgpKeyArgs = {
  request: SetPgpKey;
};


export type MutationSetPushTokenArgs = {
  request?: InputMaybe<SetPushTokenRequest>;
};


export type MutationSetReadStatusArgs = {
  request?: InputMaybe<SetReadStatusRequest>;
};


export type MutationSetUserPreferencesArgs = {
  request: SetUserPreferencesRequest;
};


export type MutationSetUserPublicKeyArgs = {
  request?: InputMaybe<SetUserPublicKeyRequest>;
};


export type MutationSetUserSignatureArgs = {
  request?: InputMaybe<SetUserSignatureRequest>;
};


export type MutationSetupLinkArgs = {
  request: SetupLinkRequest;
};


export type MutationShareDocArgs = {
  request: ShareDocRequest;
};


export type MutationShareTeamDocWithOtherTeamArgs = {
  request: ShareTeamDocWithOtherTeamRequest;
};


export type MutationSilenceMultipleEmailAddressesArgs = {
  request?: InputMaybe<SilenceMultipleEmailAddressesRequest>;
};


export type MutationStoreWorkspaceEventArgs = {
  request: WorkspaceEventRequest;
};


export type MutationSubscribeNotificationArgs = {
  request?: InputMaybe<SubscribeNotificationRequest>;
};


export type MutationUnblockEmailAddressArgs = {
  request?: InputMaybe<UnblockEmailAddressRequest>;
};


export type MutationUnmuteNotificationForSenderArgs = {
  request: UnmuteNotificationForSenderRequest;
};


export type MutationUnsendMessageArgs = {
  message?: InputMaybe<UnsendEmailRequest>;
};


export type MutationUnsilenceMultipleEmailAddressesArgs = {
  request?: InputMaybe<UnsilenceMultipleEmailAddressesRequest>;
};


export type MutationUpdateDisplayNameArgs = {
  request: UpdateDisplayNameRequest;
};


export type MutationUpdateDisplayPictureArgs = {
  request: UpdateDisplayPictureRequest;
};


export type MutationUpdateDocumentDataArgs = {
  request: UpdateDocumentDataRequest;
};


export type MutationUpdateEmailAliasActiveStateArgs = {
  request?: InputMaybe<UpdateEmailAliasActiveStateRequest>;
};


export type MutationUpdateEmailAliasProfileArgs = {
  request?: InputMaybe<UpdateEmailAliasProfileRequest>;
};


export type MutationUpdateEmailAliasSendReceiveEnabledStateArgs = {
  request: UpdateEmailAliasEnabledStateRequest;
};


export type MutationUpdateMailFilterArgs = {
  input: UpdateMailFilterInput;
};


export type MutationUpdateQuickAliasActiveStateArgs = {
  request?: InputMaybe<UpdateQuickAliasActiveStateRequest>;
};


export type MutationUpdateQuickAliasInfoArgs = {
  request: UpdateQuickAliasInfoInput;
};


export type MutationUpdateSrpArgs = {
  request: UpdateSrpRequest;
};


export type MutationUpgradeHierarchicalKeysArgs = {
  request: UpgradeHierarchicalKeysRequest;
};


export type MutationUpgradeKeyArgs = {
  request: UpgradeKeyRequest;
};


export type MutationUploadRecoveryDataArgs = {
  request: UploadRecoveryDataRequest;
};


export type MutationUploadSpamReportArgs = {
  request: UploadSpamReportRequest;
};


export type MutationVerifyCustomDomainArgs = {
  domainID: Scalars['String'];
};


export type MutationVerifyWalletAddressCreateAliasArgs = {
  request: VerifyWalletAddressCreateAliasRequest;
};


export type MutationVerifyWebAuthnRegistrationArgs = {
  request: VerifyWebAuthnRegistrationRequest;
};

export type MuteNotificationForSenderRequest = {
  emailAddresses: Array<Scalars['String']>;
};

export type NewDocRequest = {
  activeProductApp: ProductApp;
  docID: Scalars['ID'];
  documentType: NwContentType;
  encryptedContents: EncryptedContents;
  encryptedMetadata: EncryptedMetadata;
  encryptedSessionKey: Scalars['String'];
  encryptedSessionKeyEncryptedByKey: Scalars['String'];
  parentDocID?: InputMaybe<Scalars['String']>;
  parentKeysClaim?: InputMaybe<Scalars['String']>;
  parentKeysClaimEncryptedByKey?: InputMaybe<Scalars['String']>;
  parentSignature?: InputMaybe<Scalars['String']>;
  permissions: Array<PermissionEntryInput>;
  publicHierarchicalKey: Scalars['String'];
  publicHierarchicalKeyOfParent?: InputMaybe<Scalars['String']>;
  signatures: Array<Scalars['String']>;
  templateID?: InputMaybe<Scalars['String']>;
};

export type NwContentType =
  | 'FILE'
  | 'FOLDER'
  | 'PDF'
  | 'RICH_TEXT';

export type Organization = {
  __typename?: 'Organization';
  displayPictureData: DisplayPictureData;
  everyoneTeam: Team;
  hasCustomized: Scalars['Boolean'];
  name: Scalars['String'];
  orgID: Scalars['String'];
  personalTeam: Team;
  rootDocID: Scalars['String'];
  teams: Array<Team>;
};

export type OutlookInboxOrganization = {
  __typename?: 'OutlookInboxOrganization';
  categories: Array<ExternalEmailClientUserLabel>;
  folders: Array<ExternalEmailClientLabel>;
};

export type OutlookInboxOrganizationRequest = {
  importID: Scalars['String'];
};

export type PgpInfo = {
  __typename?: 'PGPInfo';
  createdAt: Scalars['Date'];
  emailAlias: Scalars['String'];
  encryptedPrivateKey: EncryptedDataOutput;
  encryptedSessionKey: EncryptedSessionKeyOutput;
  encryptionFingerprint: Scalars['String'];
  encryptionKeyID: Scalars['String'];
  publicKey: Scalars['String'];
  signingFingerprint: Scalars['String'];
  signingKeyID: Scalars['String'];
  status: PgpKeyStatus;
};

export type PgpKeyStatus =
  | 'DISABLED'
  | 'ENABLED';

export type PgpTrustLevel =
  | 'FULLY_TRUST'
  | 'MARGINAL_TRUST'
  | 'NO_TRUST'
  | 'UNKNOWN';

export type PaidUpStatus = {
  __typename?: 'PaidUpStatus';
  downgradeProgress: DowngradeProgress;
  paidUp: Scalars['Boolean'];
};

export type PendingDocumentKeyUpgradesCollaborator = {
  __typename?: 'PendingDocumentKeyUpgradesCollaborator';
  publicKey: Scalars['PublicKey'];
  userID: Scalars['String'];
};

export type PendingDocumentKeyUpgradesNewHierarchicalKey = {
  __typename?: 'PendingDocumentKeyUpgradesNewHierarchicalKey';
  collaboratorsIDs: Array<Scalars['String']>;
  currentPublicHierarchicalKey?: Maybe<Scalars['String']>;
  docID: Scalars['String'];
  encryptedLinkKey?: Maybe<Scalars['String']>;
  hierarchicalPermissionChain: Array<HierarchicalPermissionChainLink>;
};

export type PendingDocumentKeyUpgradesNewKeysClaim = {
  __typename?: 'PendingDocumentKeyUpgradesNewKeysClaim';
  currentKeysClaim?: Maybe<Scalars['String']>;
  docID: Scalars['String'];
  hierarchicalPermissionChain: Array<HierarchicalPermissionChainLink>;
  keysClaimSourceDocID: Scalars['String'];
  keysClaimSourceDocPublicHierarchicalKey?: Maybe<Scalars['String']>;
};

export type PendingDocumentKeyUpgradesOutput = {
  __typename?: 'PendingDocumentKeyUpgradesOutput';
  collaborators: Array<PendingDocumentKeyUpgradesCollaborator>;
  newHierarchicalKeys: Array<PendingDocumentKeyUpgradesNewHierarchicalKey>;
  newKeysClaims: Array<PendingDocumentKeyUpgradesNewKeysClaim>;
};

export type PendingDocumentKeyUpgradesRequest = {
  rootDocumentId: Scalars['String'];
};

export type PendingUserInvite = {
  __typename?: 'PendingUserInvite';
  docID: Scalars['String'];
  email: Scalars['String'];
  permissionLevel: PermissionLevel;
};

export type PermissionEntry = {
  __typename?: 'PermissionEntry';
  encryptedBy: Scalars['PublicKey'];
  encryptedKey?: Maybe<Scalars['String']>;
  encryptedPrivateHierarchicalKey?: Maybe<Scalars['String']>;
  expiryDate?: Maybe<Scalars['Date']>;
  userID: Scalars['String'];
};

export type PermissionEntryInput = {
  encryptedBy: Scalars['PublicKey'];
  encryptedPrivateHierarchicalKey: Scalars['String'];
  expiryDate?: InputMaybe<Scalars['Date']>;
  permissionLevel: PermissionLevel;
  userID: Scalars['String'];
};

export type PermissionLevel =
  | 'ADMIN'
  | 'EDITOR'
  | 'VIEWER';

export type PlatformInfo = {
  browserName?: InputMaybe<Scalars['String']>;
  isAndroid: Scalars['Boolean'];
  isBgTask?: InputMaybe<Scalars['Boolean']>;
  isIos: Scalars['Boolean'];
  isMacOs: Scalars['Boolean'];
  isMobile: Scalars['Boolean'];
  isReactNative?: InputMaybe<Scalars['Boolean']>;
  isSkiffWindowsDesktop?: InputMaybe<Scalars['Boolean']>;
  languageCode?: InputMaybe<Scalars['String']>;
  manufacturer?: InputMaybe<Scalars['String']>;
  timezone?: InputMaybe<Scalars['String']>;
};

export type ProductApp =
  | 'CALENDAR'
  | 'DRIVE'
  | 'MAIL'
  | 'PAGES';

export type ProvisionEmailDetails = {
  deliveryEmail: Scalars['String'];
  temporaryPassword: Scalars['String'];
};

export type ProvisionSrpRequest = {
  createSrpRequest: CreateSrpRequest;
  emailAlias: Scalars['String'];
  newUserID: Scalars['String'];
  provisionEmailDetails?: InputMaybe<ProvisionEmailDetails>;
  shareDocRequest: ShareDocRequest;
};

export type PublicData = {
  __typename?: 'PublicData';
  displayName?: Maybe<Scalars['String']>;
  displayPictureData?: Maybe<DisplayPictureData>;
};

export type Query = {
  __typename?: 'Query';
  aliasDisplayInfo?: Maybe<AliasDisplayInfo>;
  aliasValid: Scalars['Boolean'];
  allContacts: Array<Contact>;
  allDrafts: Array<Draft>;
  allowedUsers: Array<Scalars['String']>;
  attachments?: Maybe<Array<Maybe<Attachment>>>;
  autoReply?: Maybe<AutoReplyOutput>;
  billingPortal?: Maybe<CreateBillingPortalSessionOutput>;
  blockedUsers: Array<Scalars['String']>;
  browserPushNotificationsEnabled: Scalars['Boolean'];
  bulkActionJobStatus: BulkModifyLabelsJobStatusResponse;
  checkIfDomainsAvailable: CheckIfDomainsAvailableResponse;
  checkoutPortal: CheckoutSession;
  contacts: Array<Contact>;
  credits: GetCreditsResponse;
  currentUser?: Maybe<User>;
  customDomainCheckoutPortal: CheckoutSession;
  decryptionServicePublicKey?: Maybe<Scalars['PublicKey']>;
  defaultProfilePicture?: Maybe<DefaultDisplayPictureData>;
  document: Document;
  documents: Array<Document>;
  emailAutoForwardingSettings: EmailAutoForwardingSettings;
  /** Resolves metadata related to importing a user's emails from an external email client. */
  emailImportMeta: EmailImportMeta;
  filteredThreadIDs: FilteredThreadIDs;
  fullAliasInfo: Array<FullAliasInfo>;
  getAliasesOnDomain: AliasesOnDomainResponse;
  getBonfidaNames: Array<Scalars['String']>;
  getCoinbaseCheckoutID: GetCoinbaseCheckoutIdResponse;
  getCurrentUserCustomDomains: GetCurrentUserCustomDomainsResponse;
  getDomainDetails: DomainDetails;
  getDomainSuggestions: GetDomainSuggestionsResponse;
  getENSName?: Maybe<Scalars['String']>;
  getGoogleAuthURL: Scalars['String'];
  getICNSName?: Maybe<Scalars['String']>;
  getOutlookAuthUrl: Scalars['String'];
  getQuickAliasRootDomainsForUser: Array<Scalars['String']>;
  /** Info about how a user's Gmail inbox is organized */
  gmailInboxOrganization: GmailInboxOrganization;
  importStatus: Array<ImportStatusType>;
  isCustomDomain: Scalars['Boolean'];
  lastViewedReferralCredit: LastViewedReferralCreditResponse;
  mailFilters: Array<MailFilter>;
  mailbox?: Maybe<Mailbox>;
  numMailboxThreads: Scalars['Int'];
  orgMemberDefaultEmailAlias?: Maybe<Scalars['String']>;
  orgMemberEmailAliases: Array<Scalars['String']>;
  organization: Organization;
  /** Info about how a user's Outlook inbox is organized */
  outlookInboxOrganization: OutlookInboxOrganization;
  pendingDocumentKeyUpgrades: PendingDocumentKeyUpgradesOutput;
  pgpInfo: Array<Maybe<PgpInfo>>;
  searchIndexProgress: SearchIndexProgress;
  sessionCache: SessionCacheOutput;
  silenceSenderSuggestions: BulkSilenceSuggestions;
  silencedSenders: BulkSilenceSuggestions;
  spamUsers: Array<Scalars['String']>;
  unread: Scalars['Int'];
  unreadAllLabels: Array<LabelUnreadCount>;
  user?: Maybe<User>;
  userLabels: Array<UserLabel>;
  userPreferences?: Maybe<UserPreferences>;
  userSignature?: Maybe<UserSignatureOutput>;
  userThread?: Maybe<UserThread>;
  userThreads: Array<UserThread>;
  users?: Maybe<Array<User>>;
  usersFromEmailAlias: Array<Maybe<User>>;
  usersFromEmailAliasWithCatchall: Array<Maybe<User>>;
};


export type QueryAliasDisplayInfoArgs = {
  emailAlias: Scalars['String'];
};


export type QueryAliasValidArgs = {
  request: GetAliasValidRequest;
};


export type QueryAttachmentsArgs = {
  ids?: InputMaybe<Array<InputMaybe<Scalars['String']>>>;
};


export type QueryBillingPortalArgs = {
  request?: InputMaybe<GetBillingPortalSessionRequest>;
};


export type QueryBulkActionJobStatusArgs = {
  request: BulkActionJobStatusRequest;
};


export type QueryCheckIfDomainsAvailableArgs = {
  domains: Array<Scalars['String']>;
};


export type QueryCheckoutPortalArgs = {
  request: GetCheckoutSessionRequest;
};


export type QueryContactsArgs = {
  request: GetContactsRequest;
};


export type QueryCreditsArgs = {
  request: GetCreditsRequest;
};


export type QueryCustomDomainCheckoutPortalArgs = {
  request: GetCustomDomainCheckoutSessionRequest;
};


export type QueryDefaultProfilePictureArgs = {
  request: GetDefaultProfilePictureRequest;
};


export type QueryDocumentArgs = {
  request: GetDocumentRequest;
};


export type QueryDocumentsArgs = {
  request: GetDocumentsRequest;
};


export type QueryEmailImportMetaArgs = {
  request: EmailImportMetaRequest;
};


export type QueryFilteredThreadIDsArgs = {
  request: FilteredThreadIDsRequest;
};


export type QueryGetAliasesOnDomainArgs = {
  domainID: Scalars['String'];
};


export type QueryGetBonfidaNamesArgs = {
  solanaAddress: Scalars['String'];
};


export type QueryGetCoinbaseCheckoutIdArgs = {
  request: GetCoinbaseCheckoutIdRequest;
};


export type QueryGetDomainDetailsArgs = {
  domain: Scalars['String'];
};


export type QueryGetDomainSuggestionsArgs = {
  domain: Scalars['String'];
  limit?: InputMaybe<Scalars['Int']>;
};


export type QueryGetEnsNameArgs = {
  ethereumAddress: Scalars['String'];
};


export type QueryGetGoogleAuthUrlArgs = {
  action?: InputMaybe<AuthAction>;
};


export type QueryGetIcnsNameArgs = {
  cosmosAddress: Scalars['String'];
};


export type QueryGetOutlookAuthUrlArgs = {
  action?: InputMaybe<AuthAction>;
};


export type QueryGmailInboxOrganizationArgs = {
  request: GmailInboxOrganizationRequest;
};


export type QueryIsCustomDomainArgs = {
  domains: Array<Scalars['String']>;
};


export type QueryMailFiltersArgs = {
  request?: InputMaybe<GetMailFiltersInput>;
};


export type QueryMailboxArgs = {
  request: MailboxRequest;
};


export type QueryNumMailboxThreadsArgs = {
  label: Scalars['String'];
};


export type QueryOrgMemberDefaultEmailAliasArgs = {
  userID: Scalars['String'];
};


export type QueryOrgMemberEmailAliasesArgs = {
  userID: Scalars['String'];
};


export type QueryOrganizationArgs = {
  id: Scalars['String'];
};


export type QueryOutlookInboxOrganizationArgs = {
  request: OutlookInboxOrganizationRequest;
};


export type QueryPendingDocumentKeyUpgradesArgs = {
  request: PendingDocumentKeyUpgradesRequest;
};


export type QueryPgpInfoArgs = {
  allKeys?: InputMaybe<Scalars['Boolean']>;
  emailAlias?: InputMaybe<Scalars['String']>;
};


export type QuerySearchIndexProgressArgs = {
  request: GetSearchIndexProgressRequest;
};


export type QueryUnreadArgs = {
  label: Scalars['String'];
};


export type QueryUnreadAllLabelsArgs = {
  labels: Array<Scalars['String']>;
};


export type QueryUserArgs = {
  request: GetUserRequest;
};


export type QueryUserThreadArgs = {
  threadID?: InputMaybe<Scalars['String']>;
};


export type QueryUserThreadsArgs = {
  returnDeleted?: InputMaybe<Scalars['Boolean']>;
  threadIDs: Array<Scalars['String']>;
};


export type QueryUsersArgs = {
  request: GetUsersRequest;
};


export type QueryUsersFromEmailAliasArgs = {
  emailAliases: Array<Scalars['String']>;
};


export type QueryUsersFromEmailAliasWithCatchallArgs = {
  emailAliases: Array<Scalars['String']>;
};

export type QuickAlias = {
  __typename?: 'QuickAlias';
  alias: Scalars['String'];
  isSendingAndReceivingEnabled: Scalars['Boolean'];
};

export type ReferUserRequest = {
  email: Scalars['String'];
  permissionLevel?: InputMaybe<PermissionLevel>;
  referralTemplate: Scalars['String'];
};

export type ReferUserResponse = {
  __typename?: 'ReferUserResponse';
  status: RequestStatus;
};

export type RegenerateMfaBackupCodesRequest = {
  loginSrpRequest: LoginSrpRequest;
  signature: Scalars['String'];
};

export type RegenerateMfaBackupCodesResponse = {
  __typename?: 'RegenerateMfaBackupCodesResponse';
  backupCodes: Array<Scalars['String']>;
  status: RequestStatus;
};

export type RenameWebAuthnDeviceRequest = {
  credentialID: Scalars['String'];
  newName: Scalars['String'];
};

export type RenewalDetails = {
  __typename?: 'RenewalDetails';
  price?: Maybe<Scalars['Float']>;
};

export type ReplyToEmailRequest = {
  attachments: Array<EncryptedAttachmentInput>;
  bcc: Array<SendAddressRequest>;
  captchaToken: Scalars['String'];
  cc: Array<SendAddressRequest>;
  customMessageID?: InputMaybe<Scalars['String']>;
  encryptedHtml: EncryptedDataInput;
  encryptedSubject: EncryptedDataInput;
  encryptedText: EncryptedDataInput;
  encryptedTextAsHtml: EncryptedDataInput;
  encryptedTextSnippet?: InputMaybe<EncryptedDataInput>;
  externalEncryptedSessionKey?: InputMaybe<EncryptedSessionKeyInput>;
  from: SendAddressRequest;
  isPGP?: InputMaybe<Scalars['Boolean']>;
  rawSubject: Scalars['String'];
  replyID: Scalars['String'];
  scheduleSendAt?: InputMaybe<Scalars['Date']>;
  to: Array<SendAddressRequest>;
};

export type ReplyToEmailResponse = {
  __typename?: 'ReplyToEmailResponse';
  messageID: Scalars['String'];
  threadID: Scalars['String'];
};

export type RequestStatus =
  | 'FAILED'
  | 'REJECTED'
  | 'SAVED'
  | 'SUCCESS';

export type Role =
  | 'BCC'
  | 'CC'
  | 'FROM'
  | 'TO';

export type SaveCustomDomainRequest = {
  domain: Scalars['String'];
  domainID: Scalars['String'];
};

export type SaveThumbnailRequest = {
  docID: Scalars['String'];
  thumbnail?: InputMaybe<Scalars['String']>;
};

export type SaveThumbnailResponse = {
  __typename?: 'SaveThumbnailResponse';
  document: Document;
};

export type SearchIndexProgress = {
  __typename?: 'SearchIndexProgress';
  isIndexComplete: Scalars['Boolean'];
  numIndexableThreads: Scalars['Int'];
  numThreadsIndexed: Scalars['Int'];
};

export type SendAddressRequest = {
  address: Scalars['String'];
  encryptedSessionKey?: InputMaybe<EncryptedSessionKeyInput>;
  name?: InputMaybe<Scalars['String']>;
};

export type SendEmailRequest = {
  attachments: Array<EncryptedAttachmentInput>;
  bcc: Array<SendAddressRequest>;
  calendarInvite?: InputMaybe<Scalars['Boolean']>;
  captchaToken: Scalars['String'];
  cc: Array<SendAddressRequest>;
  encryptedHtml: EncryptedDataInput;
  encryptedSubject: EncryptedDataInput;
  encryptedText: EncryptedDataInput;
  encryptedTextAsHtml: EncryptedDataInput;
  encryptedTextSnippet?: InputMaybe<EncryptedDataInput>;
  externalEncryptedSessionKey?: InputMaybe<EncryptedSessionKeyInput>;
  from: SendAddressRequest;
  isPGP?: InputMaybe<Scalars['Boolean']>;
  rawSubject: Scalars['String'];
  scheduleSendAt?: InputMaybe<Scalars['Date']>;
  to: Array<SendAddressRequest>;
};

export type SendEmailResponse = {
  __typename?: 'SendEmailResponse';
  messageID: Scalars['String'];
  threadID: Scalars['String'];
};

export type SendFeedbackRequest = {
  feedback: Scalars['String'];
  feedbackPlatformString?: InputMaybe<Scalars['String']>;
  isMobile: Scalars['Boolean'];
  isNative: Scalars['Boolean'];
  isUrgent?: InputMaybe<Scalars['Boolean']>;
  origin: Scalars['String'];
  requestType?: InputMaybe<FeedbackCategoryEnum>;
  zendeskUploadTokens: Array<Scalars['String']>;
};

export type SessionCacheOutput = {
  __typename?: 'SessionCacheOutput';
  alternativeCacheKeys: Array<Scalars['String']>;
  cacheKey: Scalars['String'];
};

export type SetAllThreadsReadStatusRequest = {
  label: Scalars['String'];
  read: Scalars['Boolean'];
};

export type SetAutoReplyRequest = {
  encryptedHtml: EncryptedDataInput;
  encryptedSkiffSessionKey: EncryptedSessionKeyInput;
  encryptedSubject: EncryptedDataInput;
  encryptedText: EncryptedDataInput;
  encryptedTextAsHtml: EncryptedDataInput;
  encryptedTextSnippet?: InputMaybe<EncryptedDataInput>;
  encryptedUserSessionKey: EncryptedSessionKeyInput;
};

export type SetCatchallAddressRequest = {
  domainID: Scalars['String'];
  emailAlias?: InputMaybe<Scalars['String']>;
};

export type SetDefaultEmailAliasRequest = {
  defaultAlias: Scalars['String'];
};

export type SetLastViewedReferralCreditRequest = {
  amount: CreditAmountInput;
  count: Scalars['Int'];
};

export type SetNotificationPreferencesRequest = {
  email: Scalars['Boolean'];
  inApp: Scalars['Boolean'];
};

export type SetPdSubscribeFlagRequest = {
  subscribed: Scalars['Boolean'];
};

export type SetPgpKey = {
  disablePreviousKey?: InputMaybe<Scalars['Boolean']>;
  emailAlias: Scalars['String'];
  encryptedPrivateKey: EncryptedDataInput;
  encryptionFingerprint: Scalars['String'];
  publicKey: Scalars['String'];
  sessionKey: EncryptedSessionKeyInput;
  signingFingerprint: Scalars['String'];
};

export type SetPushTokenRequest = {
  deviceID: Scalars['String'];
  os: Scalars['String'];
  token: Scalars['String'];
};

export type SetReadStatusRequest = {
  read: Scalars['Boolean'];
  threadIDs: Array<Scalars['String']>;
};

export type SetReadStatusResponse = {
  __typename?: 'SetReadStatusResponse';
  updatedThreadIDs: Array<Scalars['String']>;
};

export type SetUserPreferencesRequest = {
  advanceToNext?: InputMaybe<Scalars['Boolean']>;
  autoAdvance?: InputMaybe<Scalars['Boolean']>;
  blockRemoteContent?: InputMaybe<Scalars['Boolean']>;
  dateFormat?: InputMaybe<Scalars['String']>;
  defaultCalendarColor?: InputMaybe<Scalars['String']>;
  defaultCalendarView?: InputMaybe<CalendarView>;
  defaultCalendarViewMobile?: InputMaybe<CalendarView>;
  fileTableFormat?: InputMaybe<FileTableDisplayFormat>;
  hideActivationChecklist?: InputMaybe<Scalars['Boolean']>;
  hourFormat?: InputMaybe<Scalars['String']>;
  leftSwipeGesture?: InputMaybe<SwipeSetting>;
  rightSwipeGesture?: InputMaybe<SwipeSetting>;
  securedBySkiffSigDisabled?: InputMaybe<Scalars['Boolean']>;
  showAliasInboxes?: InputMaybe<Scalars['Boolean']>;
  showPageIcon?: InputMaybe<Scalars['Boolean']>;
  startDayOfTheWeek?: InputMaybe<Scalars['Int']>;
  tableOfContents?: InputMaybe<TableOfContentsSetting>;
  theme?: InputMaybe<Scalars['String']>;
  threadFormat?: InputMaybe<ThreadDisplayFormat>;
};

export type SetUserPublicKeyRequest = {
  publicKey: Scalars['PublicKeyWithSignature'];
  signingPublicKey: Scalars['PublicKey'];
};

export type SetUserSignatureRequest = {
  sessionKey: EncryptedSessionKeyInput;
  userSignature: EncryptedDataInput;
};

export type SetupLinkRequest = {
  currentEncryptedSessionKey: Scalars['String'];
  currentPublicHierarchicalKey: Scalars['String'];
  docID: Scalars['String'];
  encryptedLinkKey: Scalars['String'];
  encryptedPrivateHierarchicalKey: Scalars['String'];
  encryptedSessionKey: Scalars['String'];
  linkKeySignature: Scalars['String'];
  permissionLevel: PermissionLevel;
  salt: Scalars['String'];
  sessionKeySignature: Scalars['String'];
  verifier: Scalars['String'];
};

export type SetupLinkResponse = {
  __typename?: 'SetupLinkResponse';
  document: Document;
};

export type ShareDocRequest = {
  currentPublicHierarchicalKey: Scalars['String'];
  docID: Scalars['String'];
  newPermissionEntries: Array<PermissionEntryInput>;
  signatures: Array<Scalars['String']>;
};

export type ShareDocResponse = {
  __typename?: 'ShareDocResponse';
  document: Document;
};

export type ShareTeamDocWithOtherTeamRequest = {
  documentPermissionProxy: DocumentPermissionProxyInput;
};

export type SilenceMultipleEmailAddressesRequest = {
  emailAddressesToSilence: Array<Scalars['String']>;
};

export type SilenceSenderBulkSuggestion = {
  __typename?: 'SilenceSenderBulkSuggestion';
  messageCount: Scalars['Int'];
  sender: Scalars['String'];
  totalBytes?: Maybe<Scalars['Int']>;
};

export type SilencedDomainAggregation = {
  __typename?: 'SilencedDomainAggregation';
  domain: Scalars['String'];
  senders: Array<SilenceSenderBulkSuggestion>;
};

export type SingleRetrievedRecord = {
  __typename?: 'SingleRetrievedRecord';
  data: Scalars['String'];
  priority?: Maybe<Scalars['String']>;
};

export type StorageUsage = {
  __typename?: 'StorageUsage';
  attachmentUsageBytes: Scalars['String'];
  messageUsageBytes: Scalars['String'];
};

export type SubscribeNotificationRequest = {
  auth: Scalars['String'];
  endpoint: Scalars['String'];
  p256dh: Scalars['String'];
};

export type SubscriptionInfo = {
  __typename?: 'SubscriptionInfo';
  billingInterval?: Maybe<SubscriptionInterval>;
  cancelAtPeriodEnd: Scalars['Boolean'];
  isAppleSubscription: Scalars['Boolean'];
  isCryptoSubscription: Scalars['Boolean'];
  isGoogleSubscription: Scalars['Boolean'];
  quantity?: Maybe<Scalars['Int']>;
  stripeStatus?: Maybe<Scalars['String']>;
  subscriptionPlan: Scalars['String'];
  supposedEndDate?: Maybe<Scalars['Date']>;
};

export type SubscriptionInterval =
  | 'MONTHLY'
  | 'YEARLY';

export type SubscriptionPlan =
  | 'BUSINESS'
  | 'ESSENTIAL'
  | 'FREE'
  | 'PRO';

export type SwipeSetting =
  | 'ARCHIVE'
  | 'DELETE'
  | 'UNREAD';

export type SystemLabels =
  | 'ARCHIVE'
  | 'DRAFTS'
  | 'IMPORTS'
  | 'INBOX'
  | 'QUICK_ALIASES'
  | 'SCHEDULE_SEND'
  | 'SENT'
  | 'SPAM'
  | 'TRASH'
  | 'VIRUS';

export type TableOfContentsSetting =
  | 'DISABLED'
  | 'ENABLED'
  | 'SHOW_ICON';

export type Team = {
  __typename?: 'Team';
  accessLevel?: Maybe<TeamAccess>;
  icon: Scalars['String'];
  name: Scalars['String'];
  organization: Organization;
  rootDocument?: Maybe<Document>;
  teamID: Scalars['String'];
};

export type TeamAccess =
  | 'EVERYONE'
  | 'INVITE_ONLY'
  | 'PERSONAL';

export type ThreadAttributes = {
  __typename?: 'ThreadAttributes';
  read: Scalars['Boolean'];
  systemLabels: Array<Scalars['String']>;
  userLabels: Array<UserLabel>;
};

export type ThreadDisplayFormat =
  | 'FULL'
  | 'RIGHT';

export type UnblockEmailAddressRequest = {
  emailAddressToUnblock?: InputMaybe<Scalars['String']>;
};

export type UnmuteNotificationForSenderRequest = {
  emailAddresses: Array<Scalars['String']>;
};

export type UnsendEmailRequest = {
  messageID: Scalars['String'];
  threadID: Scalars['String'];
};

export type UnsilenceMultipleEmailAddressesRequest = {
  emailAddressesToUnsilence: Array<Scalars['String']>;
};

export type UpdateDisplayNameRequest = {
  displayName: Scalars['String'];
};

export type UpdateDisplayNameResponse = {
  __typename?: 'UpdateDisplayNameResponse';
  status: RequestStatus;
};

export type UpdateDisplayPictureRequest = {
  profileAccentColor?: InputMaybe<Scalars['String']>;
  profileCustomURI?: InputMaybe<Scalars['String']>;
  profileIcon?: InputMaybe<Scalars['String']>;
};

export type UpdateDisplayPictureSkemailRequest = {
  profileAccentColor?: InputMaybe<Scalars['String']>;
  profileCustomURI?: InputMaybe<Scalars['String']>;
  profileIcon?: InputMaybe<Scalars['String']>;
};

export type UpdateDocumentDataRequest = {
  encryptedDocumentData: Scalars['String'];
  signature: Scalars['String'];
};

export type UpdateDocumentDataResponse = {
  __typename?: 'UpdateDocumentDataResponse';
  status: RequestStatus;
};

export type UpdateEmailAliasActiveStateRequest = {
  captchaToken?: InputMaybe<Scalars['String']>;
  emailAlias: Scalars['String'];
  isActive: Scalars['Boolean'];
};

export type UpdateEmailAliasActiveStateResponse = {
  __typename?: 'UpdateEmailAliasActiveStateResponse';
  status: RequestStatus;
};

export type UpdateEmailAliasEnabledStateRequest = {
  emailAlias: Scalars['String'];
  enabled: Scalars['Boolean'];
};

export type UpdateEmailAliasProfileRequest = {
  displayName?: InputMaybe<Scalars['String']>;
  displayPictureData?: InputMaybe<UpdateDisplayPictureSkemailRequest>;
  emailAlias: Scalars['String'];
  encryptedAliasData?: InputMaybe<EncryptedDataInput>;
  encryptedSessionKey?: InputMaybe<EncryptedSessionKeyInput>;
  notificationsEnabled?: InputMaybe<Scalars['Boolean']>;
};

export type UpdateMailFilterInput = {
  actions: Array<FilterActionInput>;
  encryptedByKey?: InputMaybe<Scalars['String']>;
  encryptedSessionKey?: InputMaybe<Scalars['String']>;
  filter: MailFilterInput;
  mailFilterID: Scalars['String'];
  name?: InputMaybe<Scalars['String']>;
};

export type UpdateQuickAliasActiveStateRequest = {
  captchaToken?: InputMaybe<Scalars['String']>;
  emailAlias: Scalars['String'];
  isActive: Scalars['Boolean'];
  userDomainID: Scalars['String'];
};

export type UpdateQuickAliasActiveStateResponse = {
  __typename?: 'UpdateQuickAliasActiveStateResponse';
  status: RequestStatus;
};

export type UpdateQuickAliasInfoInput = {
  areNotificationsEnabled?: InputMaybe<Scalars['Boolean']>;
  displayEmailAlias?: InputMaybe<Scalars['String']>;
  displayName?: InputMaybe<Scalars['String']>;
  displayPictureData?: InputMaybe<UpdateDisplayPictureSkemailRequest>;
  emailAlias: Scalars['String'];
  encryptedAliasData?: InputMaybe<Scalars['String']>;
  encryptedByKey?: InputMaybe<Scalars['String']>;
  encryptedSessionKey?: InputMaybe<Scalars['String']>;
};

export type UpdateSrpRequest = {
  encryptedMetamaskSecret?: InputMaybe<Scalars['String']>;
  encryptedUserData: Scalars['String'];
  loginSrpRequest?: InputMaybe<LoginSrpRequest>;
  salt: Scalars['String'];
  saltSignature: Scalars['String'];
  userDataSignature: Scalars['String'];
  verifier: Scalars['String'];
  verifierSignature: Scalars['String'];
};

export type UpdateSrpResponse = {
  __typename?: 'UpdateSrpResponse';
  status: LoginMutationStatus;
};

export type UpdatedAtField =
  | 'EMAILS_UPDATED_AT'
  | 'THREAD_CONTENT_UPDATED_AT'
  | 'UPDATED_AT';

export type UpdatedThreadLabels = {
  __typename?: 'UpdatedThreadLabels';
  systemLabels: Array<SystemLabels>;
  threadID: Scalars['String'];
  userLabels: Array<UserLabel>;
};

export type UpgradeHierarchicalKeysNewHierarchicalKeyItem = {
  docID: Scalars['String'];
  encryptedPrivateHierarchicalKeyByLinkKey?: InputMaybe<Scalars['String']>;
  encryptedSessionKey: Scalars['String'];
  encryptedSessionKeyEncryptedByKey: Scalars['String'];
  permissions: Array<UpgradeHierarchicalKeysRequestPermissionItem>;
  previousEncryptedLinkKey?: InputMaybe<Scalars['String']>;
  previousEncryptedSessionKey?: InputMaybe<Scalars['String']>;
  previousPublicHierarchicalKey?: InputMaybe<Scalars['String']>;
  publicHierarchicalKey: Scalars['String'];
};

export type UpgradeHierarchicalKeysNewKeysClaimItem = {
  docID: Scalars['String'];
  keysClaim: Scalars['String'];
  keysClaimEncryptedByKey: Scalars['String'];
  keysClaimSourceDocID: Scalars['String'];
  keysClaimSourceDocPublicHierarchicalKey: Scalars['String'];
  previousKeysClaim?: InputMaybe<Scalars['String']>;
};

export type UpgradeHierarchicalKeysRequest = {
  newHierarchicalKeys: Array<UpgradeHierarchicalKeysNewHierarchicalKeyItem>;
  newKeysClaims: Array<UpgradeHierarchicalKeysNewKeysClaimItem>;
};

export type UpgradeHierarchicalKeysRequestPermissionItem = {
  encryptedBy: Scalars['PublicKey'];
  encryptedPrivateHierarchicalKey: Scalars['String'];
  userID: Scalars['String'];
};

export type UpgradeHierarchicalKeysResponse = {
  __typename?: 'UpgradeHierarchicalKeysResponse';
  documents: Array<Document>;
};

export type UpgradeKeyRequest = {
  docID: Scalars['String'];
  encryptedContents: EncryptedContents;
  encryptedLinkKey?: InputMaybe<Scalars['String']>;
  encryptedMetadata: EncryptedMetadata;
  encryptedSessionKey: Scalars['String'];
  encryptedSessionKeyEncryptedByKey: Scalars['String'];
  previousEncryptedContentsHash: Scalars['String'];
  previousEncryptedLinkKey?: InputMaybe<Scalars['String']>;
  privateHierarchicalKeyEncryptedByLinkKey?: InputMaybe<Scalars['String']>;
  publicHierarchicalKey: Scalars['String'];
  sessionKeyEncryptedByLinkKey?: InputMaybe<Scalars['String']>;
};

export type UpgradeKeyResponse = {
  __typename?: 'UpgradeKeyResponse';
  document: Document;
};

export type UploadRecoveryDataRequest = {
  browserShareHash: Scalars['String'];
  encryptedRecoveryData: Scalars['String'];
  encryptedRecoveryDataSignature: Scalars['String'];
  paperShareHash: Scalars['String'];
  recoveryEncryptionPublicKey: Scalars['PublicKey'];
  recoveryServerShare: Scalars['String'];
  recoveryServerShareSignature: Scalars['String'];
  recoverySigningPublicKey: Scalars['PublicKey'];
};

export type UploadRecoveryDataResponse = {
  __typename?: 'UploadRecoveryDataResponse';
  status: RequestStatus;
};

export type UploadSpamReportRequest = {
  emailID: Scalars['String'];
  fromAddress: Scalars['String'];
  rawMime?: InputMaybe<Scalars['String']>;
  threadID: Scalars['String'];
};

export type User = {
  __typename?: 'User';
  accountTags?: Maybe<Array<Scalars['String']>>;
  anonymousSubdomains?: Maybe<Array<AnonymousSubdomain>>;
  autoSyncContactsSetting?: Maybe<Scalars['Boolean']>;
  canDirectlyUpdateSrp?: Maybe<Scalars['Boolean']>;
  customDomainSubscriptionsInfo?: Maybe<Array<CustomDomainSubscriptionInfo>>;
  defaultEmailAlias?: Maybe<Scalars['String']>;
  emailAliases?: Maybe<Array<Scalars['String']>>;
  encryptedRecoveryData?: Maybe<Scalars['String']>;
  invoiceHistory: InvoiceHistory;
  mfa: MfaFactors;
  numDeactivatedAnonymousSubdomains?: Maybe<Scalars['Int']>;
  paidUpStatus?: Maybe<PaidUpStatus>;
  publicData: PublicData;
  publicKey: Scalars['PublicKey'];
  quickAliases?: Maybe<Array<QuickAlias>>;
  recoveryEmail?: Maybe<Scalars['String']>;
  rootOrgID?: Maybe<Scalars['String']>;
  rootOrganization: Organization;
  signingPublicKey: Scalars['String'];
  skemailStorageUsage?: Maybe<StorageUsage>;
  storageUsed: Scalars['String'];
  subscribedToPD?: Maybe<Scalars['Boolean']>;
  subscriptionInfo: SubscriptionInfo;
  unverifiedRecoveryEmail?: Maybe<Scalars['String']>;
  userID: Scalars['String'];
  username: Scalars['String'];
  walletAddress?: Maybe<Scalars['String']>;
};

export type UserAttributionInput = {
  attributionContent?: InputMaybe<Scalars['String']>;
  attributionData?: InputMaybe<Scalars['String']>;
  attributionSource?: InputMaybe<Scalars['String']>;
  attributionTitle?: InputMaybe<Scalars['String']>;
  attributionWallet?: InputMaybe<Scalars['Boolean']>;
  referrerUsername?: InputMaybe<Scalars['String']>;
};

export type UserLabel = {
  __typename?: 'UserLabel';
  color: Scalars['String'];
  labelID: Scalars['String'];
  labelName: Scalars['String'];
  variant: UserLabelVariant;
};

export type UserLabelVariant =
  | 'ALIAS'
  | 'FOLDER'
  | 'IMPORT'
  | 'PLAIN'
  | 'QUICK_ALIAS';

export type UserPreferences = {
  __typename?: 'UserPreferences';
  advanceToNext?: Maybe<Scalars['Boolean']>;
  autoAdvance?: Maybe<Scalars['Boolean']>;
  blockRemoteContent?: Maybe<Scalars['Boolean']>;
  dateFormat?: Maybe<Scalars['String']>;
  defaultCalendarColor?: Maybe<Scalars['String']>;
  defaultCalendarView?: Maybe<CalendarView>;
  defaultCalendarViewMobile?: Maybe<CalendarView>;
  fileTableFormat?: Maybe<FileTableDisplayFormat>;
  hideActivationChecklist?: Maybe<Scalars['Boolean']>;
  hourFormat?: Maybe<Scalars['String']>;
  leftSwipeGesture?: Maybe<SwipeSetting>;
  rightSwipeGesture?: Maybe<SwipeSetting>;
  securedBySkiffSigDisabled?: Maybe<Scalars['Boolean']>;
  showAliasInboxes?: Maybe<Scalars['Boolean']>;
  showPageIcon?: Maybe<Scalars['Boolean']>;
  startDayOfTheWeek?: Maybe<Scalars['Int']>;
  tableOfContents?: Maybe<TableOfContentsSetting>;
  theme?: Maybe<Scalars['String']>;
  threadFormat?: Maybe<ThreadDisplayFormat>;
};

export type UserSignatureOutput = {
  __typename?: 'UserSignatureOutput';
  sessionKey: EncryptedSessionKeyOutput;
  userSignature: EncryptedDataOutput;
};

export type UserThread = {
  __typename?: 'UserThread';
  attributes: ThreadAttributes;
  deletedAt?: Maybe<Scalars['Date']>;
  emails: Array<Email>;
  emailsUpdatedAt: Scalars['Date'];
  senderToSilence?: Maybe<Scalars['String']>;
  senderToSilenceMessageCounter?: Maybe<Scalars['Int']>;
  senderToSilenceTotalBytes?: Maybe<Scalars['Int']>;
  sentLabelUpdatedAt?: Maybe<Scalars['Date']>;
  threadContentUpdatedAt: Scalars['Date'];
  threadID: Scalars['String'];
};

export type VerifyWalletAddressCreateAliasRequest = {
  challenge: Scalars['String'];
  challengeSignature: Scalars['String'];
  isEditorOnboarding: Scalars['Boolean'];
  source: Scalars['String'];
  walletType: Scalars['String'];
};

export type VerifyWebAuthnRegistrationRequest = {
  keyName?: InputMaybe<Scalars['String']>;
  verificationData: Scalars['JSON'];
};

export type VerifyWebAuthnRegistrationResponse = {
  __typename?: 'VerifyWebAuthnRegistrationResponse';
  status: RequestStatus;
};

export type WebAuthnKey = {
  __typename?: 'WebAuthnKey';
  credentialID: Scalars['String'];
  keyName?: Maybe<Scalars['String']>;
  lastSuccessfulChallenge?: Maybe<Scalars['Date']>;
  transports?: Maybe<Array<Scalars['String']>>;
};

export type WorkspaceEventRequest = {
  data: Scalars['String'];
  eventName: WorkspaceEventType;
  platformInfo?: InputMaybe<PlatformInfo>;
  version: Scalars['String'];
};

export type WorkspaceEventType =
  | 'ACCEPT_INVITE_FAIL'
  | 'ACCOUNT_RECOVERY_FAILURE'
  | 'ACCOUNT_RECOVERY_FORGOT_PASSWORD'
  | 'ACCOUNT_RECOVERY_FORGOT_PASSWORD_MOBILE'
  | 'ACCOUNT_RECOVERY_KEY_RESET'
  | 'ACCOUNT_RECOVERY_NO_ACCOUNT_FOUND'
  | 'ACCOUNT_RECOVERY_NO_BROWSER_SHARE'
  | 'ACCOUNT_RECOVERY_SUCCESS'
  | 'ACCOUNT_RECOVERY_TOGGLE'
  | 'ACTIVATION_CHECKLIST_ITEM_CLICK'
  | 'ACTIVATION_CHECKLIST_PERMANENTLY_HIDE'
  | 'ACTIVATION_CHECKLIST_START_CHECKOUT'
  | 'ACTIVATION_CHECKLIST_TOGGLE'
  | 'ADD_ACCOUNT_START'
  | 'ALIAS_INBOX_DISABLED'
  | 'ALIAS_INBOX_ENABLED'
  | 'ALIAS_NEXT'
  | 'AUTO_FORWARDING_DISABLED'
  | 'AUTO_FORWARDING_ENABLED'
  | 'BACKGROUND_TASK_DURATION'
  | 'BUY_CUSTOM_DOMAIN_CLICK'
  | 'BUY_CUSTOM_DOMAIN_WITH_TRIAL_CLICK'
  | 'CLOSE_BANNER'
  | 'CLOSE_DOWNLOAD_CALENDAR_MOBILE_BANNER'
  | 'CLOSE_NOISE_CANCEL_FOOTER'
  | 'CLOSE_SKEMAIL_BANNER'
  | 'CREATE_MAIL_FILTER_CLICKED'
  | 'CRYPTO_CHECKOUT_STARTED'
  | 'CUSTOM_DOMAIN_PURCHASED'
  | 'CUSTOM_DOMAIN_SUGGESTIONS_SHOWN'
  | 'DASHBOARD_INVITE_SENT'
  | 'DELINQUENCY_BANNER_CLICK'
  | 'DELINQUENCY_BANNER_SHOWN'
  | 'DELINQUENCY_MODAL_SHOWN'
  | 'DELINQUENCY_MODAL_UPGRADE_CLICK'
  | 'DIRECT_ONBOARDING_CALENDAR'
  | 'DIRECT_ONBOARDING_DRIVE'
  | 'DIRECT_ONBOARDING_MAIL'
  | 'DIRECT_ONBOARDING_PAGES'
  | 'DISABLE_DEFAULT_SIGNATURE'
  | 'DRIVE_IMPORT'
  | 'DRIVE_SIGN_IN_INITIATE'
  | 'DRIVE_SIGN_IN_SUCCESS'
  | 'DRIVE_START'
  | 'ENABLE_DEFAULT_SIGNATURE'
  | 'GENERATE_JITSI_LINK'
  | 'GET_STARTED_CHECKLIST_ALL_COMPLETE'
  | 'GET_STARTED_CHECKLIST_ITEM_CLICK'
  | 'GET_STARTED_CHECKLIST_ITEM_COMPLETE'
  | 'GET_STARTED_CHECKLIST_ITEM_SKIP'
  | 'GET_STARTED_CHECKLIST_PARTIAL_COMPLETE'
  | 'GET_STARTED_CHECKLIST_SKIP_ALL'
  | 'GET_STARTED_STEP_COMPLETE'
  | 'GET_STARTED_STEP_SKIP'
  | 'IMPORT_STEP_CONTINUE'
  | 'IMPORT_STEP_SKIP'
  | 'IMPORT_UPGRADE_MODAL_SHOWN'
  | 'IPFS_TOGGLE'
  | 'JOYRIDE_SKIP'
  | 'LOGIN_PAGE'
  | 'LOGOUT'
  | 'MAIL_IMPORT_OPEN'
  | 'MARK_NOT_NOISE'
  | 'MARK_SILENCE'
  | 'MARK_UNSILENCE'
  | 'MARK_UNSUBSCRIBE'
  | 'MOBILE_MAIL_APP_ERROR'
  | 'MOBILE_THREAD_RECOVERED'
  | 'NATIVE_ADD_ACCOUNT'
  | 'NEW_UPLOAD'
  | 'ONBOARDING_DOWNLOAD_RECOVERY_KEY'
  | 'ONBOARDING_PLAN_SELECT'
  | 'ONBOARDING_RECOVERY_INSTRUCTION'
  | 'ONBOARDING_SELECT_CALENDAR'
  | 'ONBOARDING_SELECT_DRIVE'
  | 'ONBOARDING_SELECT_LEARN_MORE'
  | 'ONBOARDING_SELECT_MAIL'
  | 'ONBOARDING_SELECT_PAGES'
  | 'ONBOARDING_SET_RECOVERY_EMAIL'
  | 'ONBOARDING_STEP_FINISHED'
  | 'ONBOARDING_STEP_SHOWN'
  | 'ONBOARDING_VIEW_PLAN_DETAILS_CLICK'
  | 'ONBOARD_INVITE_SENT'
  | 'OPEN_INBOX_FIRST_TIME_FROM_ORG_SELECT'
  | 'OPEN_INBOX_FROM_BANNER'
  | 'OPEN_INBOX_FROM_JOYRIDE'
  | 'OPEN_NOISE_CANCEL_FOOTER'
  | 'OPEN_SKEMAIL_ANDROID_APP_FROM_BANNER'
  | 'OPEN_SKEMAIL_IPHONE_APP_FROM_BANNER'
  | 'PERFORMED_BACKGROUND_TASK'
  | 'PLAN_CHANGE_STARTED'
  | 'PLAN_TABLE_SHOWN'
  | 'PREMIUM_USERNAME_CLAIM_ATTEMPTED'
  | 'PREMIUM_USERNAME_MODAL_OPENED'
  | 'PUBLIC_SITE_PRICING_PAGE_ONBOARDING'
  | 'PW_NEXT_BTN'
  | 'QUICK_ALIAS_SETTINGS_OPENED'
  | 'QUICK_ALIAS_WARNING_BANNER_CLICK'
  | 'QUICK_ALIAS_WARNING_BANNER_SHOWN'
  | 'REQUESTED_PREMIUM_USERNAME'
  | 'SEARCH'
  | 'SELECT_THEME'
  | 'SIGNUP_CONNECT_WALLET_START'
  | 'SIGNUP_START'
  | 'SKEMAIL_APP_CREATE_FOLDER'
  | 'SKEMAIL_APP_CREATE_LABEL'
  | 'SKEMAIL_APP_LOADING_TIME'
  | 'SKEMAIL_APP_LOADING_TIMEOUT'
  | 'SKEMAIL_APP_LOGIN'
  | 'SKEMAIL_APP_LOGIN_ATTEMPT'
  | 'SKEMAIL_APP_OPEN_COMPOSE'
  | 'SKEMAIL_APP_SEND_CLICK'
  | 'SKEMAIL_APP_THREAD_LOADING_TIME'
  | 'SWITCH_FROM_EDITOR_TO_EMAIL'
  | 'SWITCH_FROM_EMAIL_TO_EDITOR'
  | 'TOAST_CTA_CLICK'
  | 'TOAST_IMPRESSION'
  | 'TWO_FACTOR_TOGGLE'
  | 'UPGRADE_FROM_SEARCH'
  | 'UPGRADE_FROM_STORAGE'
  | 'UPGRADE_FROM_UPLOAD'
  | 'UPGRADE_STARTED'
  | 'USER_BROWSER'
  | 'USER_MAC_DESKTOP'
  | 'USER_OS'
  | 'USER_PLATFORM'
  | 'USER_REACT_NATIVE'
  | 'USER_SKEMAIL_APP'
  | 'USER_WINDOWS_DESKTOP';
