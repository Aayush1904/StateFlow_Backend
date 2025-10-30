import mongoose, { Schema, Document } from 'mongoose';

export interface PageVersionDocument extends Document {
  _id: string;
  pageId: mongoose.Types.ObjectId;
  version: number;
  title: string;
  content: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  changeDescription?: string;
}

const pageVersionSchema = new Schema<PageVersionDocument>(
  {
    pageId: {
      type: Schema.Types.ObjectId,
      ref: 'Page',
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    changeDescription: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for efficient queries
pageVersionSchema.index({ pageId: 1, version: -1 });
pageVersionSchema.index({ pageId: 1, createdAt: -1 });

const PageVersionModel = mongoose.model<PageVersionDocument>('PageVersion', pageVersionSchema);

export default PageVersionModel;
