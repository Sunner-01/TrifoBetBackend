import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PersonalService } from './personal.service';
import { AdminGuard } from './guards/admin.guard';

@Controller('admin/personal')
@UseGuards(AdminGuard)
export class PersonalController {
  constructor(private readonly personalService: PersonalService) {}

  @Get()
  async getPersonal(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.personalService.getPersonal({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
    });
  }

  @Post()
  async createPersonal(@Body() dto: any) {
    return this.personalService.createPersonal(dto);
  }

  @Put(':id/toggle-habilitado')
  async toggleHabilitado(@Param('id') id: string) {
    return this.personalService.toggleHabilitado(parseInt(id));
  }

  @Put(':id/reset-password')
  async resetPassword(@Param('id') id: string) {
    return this.personalService.resetPassword(parseInt(id));
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.personalService.getPersonalStats(parseInt(id));
  }

  @Put(':id')
  async updatePersonal(@Param('id') id: string, @Body() dto: any) {
    return this.personalService.updatePersonal(parseInt(id), dto);
  }
}