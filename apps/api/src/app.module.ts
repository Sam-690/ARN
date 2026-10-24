import { Module } from '@nestjs/common';
import { AuthController } from './modules/auth.controller';
import { BudgetController } from './modules/budget.controller';
import { CatalogController } from './modules/catalog.controller';
import { ChangesController } from './modules/changes.controller';
import { DataController } from './modules/data.controller';
import { DocumentsController } from './modules/documents.controller';
import { ExperienceController } from './modules/experience.controller';
import { LogsController } from './modules/logs.controller';
import { OrdersController } from './modules/orders.controller';
import { PlansController } from './modules/plans.controller';
import { ProjectsController } from './modules/projects.controller';
import { StockController } from './modules/stock.controller';
import { SupplyController } from './modules/supply.controller';
import { UsersController } from './modules/users.controller';
@Module({
  controllers: [
    AuthController,
    UsersController,
    DataController,
    ProjectsController,
    CatalogController,
    BudgetController,
    OrdersController,
    StockController,
    SupplyController,
    ChangesController,
    ExperienceController,
    DocumentsController,
    PlansController,
    LogsController,
  ],
})
export class AppModule {}
