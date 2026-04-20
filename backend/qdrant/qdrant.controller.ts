import {
  Controller,
  Get,
  Param,
  Query,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { QdrantService } from './qdrant.service';

@Controller('qdrant')
export class QdrantController {
  private readonly logger = new Logger(QdrantController.name);

  constructor(private readonly qdrantService: QdrantService) {}

  // GET /qdrant/collections
  @Get('collections')
  async listCollections() {
    try {
      const collections = await this.qdrantService.listCollections();
      return { message: 'Collections listed', data: collections };
    } catch (err) {
      this.logger.error('Failed to list collections', err as Error);
      throw new InternalServerErrorException('Failed to list Qdrant collections');
    }
  }

  // GET /qdrant/collections/:name
  @Get('collections/:name')
  async getCollectionInfo(@Param('name') name: string) {
    try {
      const info = await this.qdrantService.getCollectionInfo(name);
      return { message: 'Collection info fetched', data: info };
    } catch (err) {
      this.logger.error(`Failed to get collection info: ${name}`, err as Error);
      throw new InternalServerErrorException('Failed to get collection info');
    }
  }

  // GET /qdrant/gaps/top?limit=20
  @Get('gaps/top')
  async getTopGaps(@Query('limit') limit?: string) {
    try {
      const data = await this.qdrantService.getTopGapStatistics(
        limit ? parseInt(limit, 10) : 20,
      );
      return { message: 'Top gap statistics fetched', data };
    } catch (err) {
      this.logger.error('Failed to fetch top gap statistics', err as Error);
      throw new InternalServerErrorException('Failed to fetch gap statistics');
    }
  }

  // GET /qdrant/gaps/student/:authId?limit=200&metier=...
  @Get('gaps/student/:authId')
  async getStudentGaps(
    @Param('authId') authId: string,
    @Query('limit') limit?: string,
    @Query('metier') metier?: string,
  ) {
    try {
      const data = await this.qdrantService.getStudentGaps(authId, {
        limit: limit ? parseInt(limit, 10) : 200,
        metier,
      });
      return { message: 'Student gaps fetched', data };
    } catch (err) {
      this.logger.error(`Failed to fetch gaps for student ${authId}`, err as Error);
      throw new InternalServerErrorException('Failed to fetch student gaps');
    }
  }
}
