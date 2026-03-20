-- GLX Insights — Multi-Tenant AI Chat
-- Migration: 0011_ai_chat_multitenant

CREATE TABLE `ai_projects` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `name` varchar(120) NOT NULL,
  `description` text,
  `systemPrompt` text,
  `archived` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `ai_projects_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `ai_projects_userId_idx` (`userId`)
);

CREATE TABLE `ai_conversations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `projectId` int,
  `title` varchar(160) NOT NULL DEFAULT 'Nova conversa',
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `tokensSent` int NOT NULL DEFAULT 0,
  `tokensReceived` int NOT NULL DEFAULT 0,
  `estimatedCostUsd` decimal(10,6) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `ai_conversations_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ai_conversations_projectId_fk` FOREIGN KEY (`projectId`) REFERENCES `ai_projects`(`id`) ON DELETE SET NULL,
  INDEX `ai_conversations_userId_idx` (`userId`),
  INDEX `ai_conversations_projectId_idx` (`projectId`)
);

CREATE TABLE `ai_messages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `conversationId` int NOT NULL,
  `userId` int NOT NULL,
  `role` enum('user','assistant','system') NOT NULL,
  `content` text NOT NULL,
  `tokensIn` int NOT NULL DEFAULT 0,
  `tokensOut` int NOT NULL DEFAULT 0,
  `modelUsed` varchar(60),
  `requestType` enum('simple','standard','complex','summary'),
  `estimatedCostUsd` decimal(10,6) NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `ai_messages_conversationId_fk` FOREIGN KEY (`conversationId`) REFERENCES `ai_conversations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ai_messages_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `ai_messages_conversationId_idx` (`conversationId`),
  INDEX `ai_messages_userId_idx` (`userId`)
);

CREATE TABLE `ai_context_summaries` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `conversationId` int NOT NULL,
  `userId` int NOT NULL,
  `summaryText` text NOT NULL,
  `upToMessageId` int NOT NULL,
  `tokensUsed` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `ai_ctx_conversationId_fk` FOREIGN KEY (`conversationId`) REFERENCES `ai_conversations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ai_ctx_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `ai_ctx_upToMessageId_fk` FOREIGN KEY (`upToMessageId`) REFERENCES `ai_messages`(`id`) ON DELETE CASCADE,
  INDEX `ai_context_summaries_conversationId_idx` (`conversationId`)
);

CREATE TABLE `ai_usage_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `conversationId` int,
  `projectId` int,
  `tokensIn` int NOT NULL,
  `tokensOut` int NOT NULL,
  `totalTokens` int NOT NULL,
  `estimatedCostUsd` decimal(10,6) NOT NULL,
  `modelUsed` varchar(60) NOT NULL,
  `requestType` enum('simple','standard','complex','summary') NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `ai_usage_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `ai_usage_userId_idx` (`userId`),
  INDEX `ai_usage_createdAt_idx` (`createdAt`)
);

CREATE TABLE `ai_user_limits` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL UNIQUE,
  `dailyBudgetUsd` decimal(8,4),
  `monthlyBudgetUsd` decimal(8,4),
  `alertAtPercent` int NOT NULL DEFAULT 80,
  `isBlocked` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `ai_limits_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
