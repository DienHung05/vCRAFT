import { Module } from '@nestjs/common';
import { UsersService } from './application/users.service';
import { MeController } from './users.controller';

@Module({
  controllers: [MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
