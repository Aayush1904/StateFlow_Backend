import { google } from 'googleapis';
import IntegrationModel, { IntegrationStatus } from '../models/integration.model';
import { NotFoundException, BadRequestException } from '../utils/appError';
import { config } from '../config/app.config';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  htmlLink?: string;
  status?: string;
}

export const syncGoogleCalendarEventsService = async (
  integrationId: string,
  timeMin?: string,
  timeMax?: string
): Promise<{ events: CalendarEvent[]; synced: number }> => {
  const integration = await IntegrationModel.findById(integrationId);
  if (!integration) {
    throw new NotFoundException('Integration not found');
  }

  if (integration.type !== 'google_calendar') {
    throw new BadRequestException('Integration is not a Google Calendar integration');
  }

  const { accessToken, refreshToken } = integration.config;

  if (!accessToken) {
    throw new BadRequestException('Google Calendar access token is missing');
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Auto-refresh token if expired
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        integration.config.refreshToken = tokens.refresh_token;
      }
      if (tokens.access_token) {
        integration.config.accessToken = tokens.access_token;
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Set default time range if not provided (next 30 days)
    const now = new Date();
    const defaultTimeMin = timeMin || now.toISOString();
    const defaultTimeMax =
      timeMax ||
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: defaultTimeMin,
      timeMax: defaultTimeMax,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const formattedEvents: CalendarEvent[] =
      data.items?.map((event) => ({
        id: event.id || '',
        summary: event.summary || 'Untitled Event',
        description: event.description || undefined,
        start: {
          dateTime: event.start?.dateTime ?? undefined,
          date: event.start?.date ?? undefined,
          timeZone: event.start?.timeZone ?? undefined,
        },
        end: {
          dateTime: event.end?.dateTime ?? undefined,
          date: event.end?.date ?? undefined,
          timeZone: event.end?.timeZone ?? undefined,
        },
        location: event.location ?? undefined,
        attendees: event.attendees?.map((attendee) => ({
          email: attendee.email || '',
          displayName: attendee.displayName ?? undefined,
          responseStatus: attendee.responseStatus ?? undefined,
        })),
        htmlLink: event.htmlLink ?? undefined,
        status: event.status ?? undefined,
      })) || [];

    // Update integration metadata
    integration.metadata = {
      ...integration.metadata,
      lastSyncAt: new Date(),
      syncStatus: 'success',
      lastSyncCount: formattedEvents.length,
    };

    await integration.save();

    return {
      events: formattedEvents,
      synced: formattedEvents.length,
    };
  } catch (error: any) {
    // Update integration with error status
    integration.metadata = {
      ...integration.metadata,
      lastSyncAt: new Date(),
      syncStatus: 'error',
      errorMessage: error.message || 'Failed to sync Google Calendar events',
    };
    integration.status = IntegrationStatus.ERROR;
    await integration.save();

    throw new BadRequestException(
      `Failed to sync Google Calendar events: ${error.message || 'Unknown error'}`
    );
  }
};

export const createGoogleCalendarEventService = async (
  integrationId: string,
  body: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    location?: string;
    attendees?: string[];
  }
): Promise<{ event: CalendarEvent }> => {
  const integration = await IntegrationModel.findById(integrationId);
  if (!integration) {
    throw new NotFoundException('Integration not found');
  }

  const { accessToken, refreshToken } = integration.config;

  if (!accessToken) {
    throw new BadRequestException('Google Calendar integration is not properly configured');
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Auto-refresh token if expired
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        integration.config.refreshToken = tokens.refresh_token;
      }
      if (tokens.access_token) {
        integration.config.accessToken = tokens.access_token;
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const { data: event } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: body.summary,
        description: body.description,
        start: {
          dateTime: body.start.dateTime,
          timeZone: body.start.timeZone || 'UTC',
        },
        end: {
          dateTime: body.end.dateTime,
          timeZone: body.end.timeZone || 'UTC',
        },
        location: body.location,
        attendees: body.attendees?.map((email) => ({ email })),
      },
    });

    const formattedEvent: CalendarEvent = {
      id: event.id || '',
      summary: event.summary || 'Untitled Event',
      description: event.description ?? undefined,
      start: {
        dateTime: event.start?.dateTime ?? undefined,
        date: event.start?.date ?? undefined,
        timeZone: event.start?.timeZone ?? undefined,
      },
      end: {
        dateTime: event.end?.dateTime ?? undefined,
        date: event.end?.date ?? undefined,
        timeZone: event.end?.timeZone ?? undefined,
      },
      location: event.location ?? undefined,
      attendees: event.attendees?.map((attendee) => ({
        email: attendee.email || '',
        displayName: attendee.displayName ?? undefined,
        responseStatus: attendee.responseStatus ?? undefined,
      })),
      htmlLink: event.htmlLink ?? undefined,
      status: event.status ?? undefined,
    };

    return { event: formattedEvent };
  } catch (error: any) {
    throw new BadRequestException(
      `Failed to create Google Calendar event: ${error.message || 'Unknown error'}`
    );
  }
};

