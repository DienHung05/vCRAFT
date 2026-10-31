import { Module } from '@nestjs/common';
import { NotificationPublisher } from './application/notification-publisher';
import { NotificationsService } from './application/notifications.service';
import {
  NotificationPreferencesController,
  NotificationsController,
} from './notifications.controller';

@Module({
  controllers: [NotificationsController, NotificationPreferencesController],
  providers: [NotificationsService, NotificationPublisher],
  exports: [NotificationPublisher],
})
export class NotificationsModule {}
