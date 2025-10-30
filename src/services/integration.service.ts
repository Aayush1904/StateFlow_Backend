import mongoose from 'mongoose';
import IntegrationModel, { IntegrationType, IntegrationStatus, IntegrationDocument } from '../models/integration.model';
import { NotFoundException, BadRequestException } from '../utils/appError';

export const createIntegrationService = async (
  workspaceId: string,
  userId: string,
  body: {
    type: IntegrationType;
    name: string;
    config: Record<string, any>;
  }
) => {
  const { type, name, config } = body;

  // Validate integration type
  if (!Object.values(IntegrationType).includes(type)) {
    throw new BadRequestException('Invalid integration type');
  }

  const integration = new IntegrationModel({
    workspace: new mongoose.Types.ObjectId(workspaceId),
    type,
    name,
    config,
    status: IntegrationStatus.INACTIVE,
    createdBy: new mongoose.Types.ObjectId(userId),
  });

  await integration.save();

  return { integration };
};

export const getIntegrationsByWorkspaceService = async (workspaceId: string) => {
  const integrations = await IntegrationModel.find({
    workspace: new mongoose.Types.ObjectId(workspaceId),
  })
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  return { integrations };
};

export const getIntegrationByIdService = async (integrationId: string) => {
  const integration = await IntegrationModel.findById(integrationId)
    .populate('createdBy', 'name email');

  if (!integration) {
    throw new NotFoundException('Integration not found');
  }

  return { integration };
};

export const updateIntegrationService = async (
  integrationId: string,
  userId: string,
  body: {
    name?: string;
    config?: Record<string, any>;
    status?: IntegrationStatus;
    metadata?: Record<string, any>;
  }
) => {
  const { name, config, status, metadata } = body;

  const integration = await IntegrationModel.findById(integrationId);
  if (!integration) {
    throw new NotFoundException('Integration not found');
  }

  if (name !== undefined) {
    integration.name = name;
  }

  if (config !== undefined) {
    integration.config = { ...integration.config, ...config };
  }

  if (status !== undefined) {
    integration.status = status;
  }

  if (metadata !== undefined) {
    integration.metadata = { ...integration.metadata, ...metadata };
  }

  await integration.save();

  return { integration };
};

export const deleteIntegrationService = async (integrationId: string) => {
  const integration = await IntegrationModel.findById(integrationId);
  if (!integration) {
    throw new NotFoundException('Integration not found');
  }

  await IntegrationModel.findByIdAndDelete(integrationId);

  return { message: 'Integration deleted successfully' };
};

export const testIntegrationService = async (integrationId: string) => {
  const integration = await IntegrationModel.findById(integrationId);
  if (!integration) {
    throw new NotFoundException('Integration not found');
  }

  // This will be implemented by specific integration services
  // For now, return basic validation
  const isValid = integration.config && Object.keys(integration.config).length > 0;

  return {
    valid: isValid,
    message: isValid ? 'Integration configuration is valid' : 'Integration configuration is invalid',
  };
};





