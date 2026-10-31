import { Body, Controller, Get, Header, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  ListNotificationsQuerySchema,
  UpdateNotificationPreferencesRequestSchema,
} from '@vcraft/contracts';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { NotificationsService } from './application/notifications.service';

/**
 * Chuông thông báo (GH#37): client hỏi lại theo chu kỳ, không có SSE. Mọi vai trò đã đăng nhập đều
 * dùng được, kể cả hộ chưa được duyệt (để nhận kết quả duyệt hồ sơ).
 */
@Controller('me/notifications')
@Roles('BUYER', 'ADMIN', 'HOUSEHOLD')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(ListNotificationsQuerySchema))
    query: ReturnType<typeof ListNotificationsQuerySchema.parse>,
  ) {
    return this.notifications.list(actor, query.limit);
  }

  @Get('unread-count')
  @Header('Cache-Control', 'private, no-store')
  unreadCount(@CurrentActor() actor: Actor) {
    return this.notifications.unreadCount(actor);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentActor() actor: Actor) {
    return this.notifications.markAllRead(actor);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.notifications.markRead(actor, id);
  }
}

/** Tùy chọn nhận email theo loại thông báo (FR-NOTI-02). */
@Controller('me/notification-preferences')
@Roles('BUYER', 'ADMIN', 'HOUSEHOLD')
export class NotificationPreferencesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentActor() actor: Actor) {
    return this.notifications.preferences(actor);
  }

  @Put()
  update(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(UpdateNotificationPreferencesRequestSchema))
    body: ReturnType<typeof UpdateNotificationPreferencesRequestSchema.parse>,
  ) {
    return this.notifications.updatePreferences(actor, body);
  }
}
