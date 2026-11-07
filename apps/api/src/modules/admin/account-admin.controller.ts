import { Body, Controller, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  type AdminUserListQuery,
  AdminUserListQuerySchema,
  type InviteAccountRequest,
  InviteAccountRequestSchema,
  type SuspendUserRequest,
  SuspendUserRequestSchema,
  type UnsuspendUserRequest,
  UnsuspendUserRequestSchema,
} from '@vcraft/contracts';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AccountAdminService } from './application/account-admin.service';

/** Accounts for the board: search, suspend and unsuspend (FR-AUTH-10). */
@Controller('admin/users')
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly accounts: AccountAdminService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query(new ZodValidationPipe(AdminUserListQuerySchema)) query: AdminUserListQuery) {
    return this.accounts.listUsers(query);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  suspend(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(SuspendUserRequestSchema)) body: SuspendUserRequest,
  ) {
    return this.accounts.suspend(actor, id, body);
  }

  @Post(':id/unsuspend')
  @HttpCode(200)
  unsuspend(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(UnsuspendUserRequestSchema)) body: UnsuspendUserRequest,
  ) {
    return this.accounts.unsuspend(actor, id, body);
  }
}

/** Invitations by email (FR-AUTH-03). */
@Controller('admin/invitations')
@Roles('ADMIN')
export class AdminInvitationsController {
  constructor(private readonly accounts: AccountAdminService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list() {
    return this.accounts.listInvitations();
  }

  @Post()
  @HttpCode(200)
  invite(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(InviteAccountRequestSchema)) body: InviteAccountRequest,
  ) {
    return this.accounts.invite(actor, body);
  }
}
