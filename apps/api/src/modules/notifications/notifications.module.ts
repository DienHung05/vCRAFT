import { Module } from '@nestjs/common';
import { NotificationPublisher } from './application/notification-publisher';
import { NotificationsService } from './application/notifications.service';
import { LiveEventsController } from './live-events.controller';
import {
  NotificationPreferencesController,
  NotificationsController,
} from './notifications.controller';

@Module({
  controllers: [NotificationsController, NotificationPreferencesController, LiveEventsController],
  providers: [NotificationsService, NotificationPublisher],
  exports: [NotificationPublisher],
})
export class NotificationsModule {}
