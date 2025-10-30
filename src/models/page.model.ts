import mongoose, { Schema, Document } from 'mongoose';

export interface PageDocument extends Document {
  _id: string;
  title: string;
  content: string;
  workspace: mongoose.Types.ObjectId;
  project?: mongoose.Types.ObjectId;
  parent?: mongoose.Types.ObjectId;
  slug: string;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<PageDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Page',
      default: null,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
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
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for efficient queries
pageSchema.index({ workspace: 1, project: 1 });
pageSchema.index({ workspace: 1, parent: 1 });

const PageModel = mongoose.model<PageDocument>('Page', pageSchema);

export default PageModel;
