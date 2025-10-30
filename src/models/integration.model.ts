import mongoose, { Schema, Document } from 'mongoose';

export enum IntegrationType {
  GITHUB = 'github',
  GOOGLE_CALENDAR = 'google_calendar',
  JIRA = 'jira',
  SLACK = 'slack',
}

export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

export interface IntegrationDocument extends Document {
  _id: string;
  workspace: mongoose.Types.ObjectId;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  config: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    apiKey?: string;
    apiSecret?: string;
    organization?: string;
    repository?: string;
    webhookUrl?: string;
    scopes?: string[];
    [key: string]: any; // Allow additional config fields
  };
  metadata?: {
    lastSyncAt?: Date;
    syncStatus?: string;
    errorMessage?: string;
    [key: string]: any;
  };
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const integrationSchema = new Schema<IntegrationDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(IntegrationType),
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(IntegrationStatus),
      default: IntegrationStatus.INACTIVE,
    },
    config: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient queries
integrationSchema.index({ workspace: 1, type: 1 });
integrationSchema.index({ workspace: 1, status: 1 });

const IntegrationModel = mongoose.model<IntegrationDocument>('Integration', integrationSchema);

export default IntegrationModel;





