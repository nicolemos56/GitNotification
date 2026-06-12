/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MonitoredUser {
  github_username: string;
  avatar_url?: string;
  added_at: string;
}

export interface ProcessedRepository {
  id: number;
  repo_id: number;
  repo_name: string;
  owner_username: string;
  html_url: string;
  detected_at: string;
  ai_summary: string | null;
  tech_stack: string | null;
  notification_sent: boolean;
  channel_used: "Telegram" | "WhatsApp" | "Local Feed";
}

export interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  is_enabled: boolean;
}

export interface WhatsAppConfig {
  twilio_sid: string;
  twilio_token: string;
  phone_from: string;
  phone_to: string;
  is_enabled: boolean;
}

export interface LogItem {
  timestamp: string;
  level: "info" | "success" | "warn" | "error" | "ai";
  message: string;
}

export interface SystemStatus {
  is_automation_active: boolean;
  last_poll: string | null;
  polls_count: number;
}
