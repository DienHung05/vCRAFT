import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { FavouritesService } from './application/favourites.service';
import { FavouritesController } from './favourites.controller';

@Module({
  imports: [MediaModule],
  controllers: [FavouritesController],
  providers: [FavouritesService],
})
export class FavouritesModule {}
