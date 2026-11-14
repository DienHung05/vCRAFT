import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { LiveNoticeSubscriber } from './application/live-notice-subscriber';
import { LiveSignal } from './application/live-signal';
import { NotificationPublisher } from './application/notification-publisher';
import { NotificationsService } from './application/notifications.service';
import { LiveEventsController } from './live-events.controller';
import {
  NotificationPreferencesController,
  NotificationsController,
} from './notifications.controller';

@Module({
  imports: [MediaModule],
  controllers: [NotificationsController, NotificationPreferencesController, LiveEventsController],
  providers: [NotificationsService, NotificationPublisher, LiveSignal, LiveNoticeSubscriber],
  exports: [NotificationPublisher],
})
export class NotificationsModule {}
