import { Controller, Delete, Get, Header, HttpCode, Param, Put } from '@nestjs/common';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { FavouritesService } from './application/favourites.service';

/** Saved products of the signed-in user (FR-CAT-07); guests keep their list in the browser. */
@Controller('me/favourites')
@Roles('BUYER', 'ADMIN', 'HOUSEHOLD')
export class FavouritesController {
  constructor(private readonly favourites: FavouritesService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentActor() actor: Actor) {
    return this.favourites.list(actor);
  }

  @Put(':productId')
  @HttpCode(204)
  async add(@CurrentActor() actor: Actor, @Param('productId', new UuidPipe()) productId: string) {
    await this.favourites.add(actor, productId);
  }

  @Delete(':productId')
  @HttpCode(204)
  async remove(
    @CurrentActor() actor: Actor,
    @Param('productId', new UuidPipe()) productId: string,
  ) {
    await this.favourites.remove(actor, productId);
  }
}
