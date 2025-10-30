import mongoose, { Schema, Document } from 'mongoose';

export interface PageTemplateDocument extends Document {
  _id: string;
  name: string;
  description?: string;
  content: string;
  workspace: mongoose.Types.ObjectId;
  category: string; // e.g., 'meeting-notes', 'sprint-retro', 'project-plan', etc.
  isDefault: boolean; // Default templates available to all workspaces
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const pageTemplateSchema = new Schema<PageTemplateDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    content: {
      type: String,
      required: true,
      default: '',
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null, // null for default templates, ObjectId for workspace-specific templates
    },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: ['meeting-notes', 'sprint-retro', 'project-plan', 'daily-standup', 'custom', 'other'],
      default: 'custom',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
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
pageTemplateSchema.index({ workspace: 1, category: 1 });
pageTemplateSchema.index({ isDefault: 1, category: 1 });

const PageTemplateModel = mongoose.model<PageTemplateDocument>('PageTemplate', pageTemplateSchema);

export default PageTemplateModel;

