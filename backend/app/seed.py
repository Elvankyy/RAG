from __future__ import annotations

import asyncio

from sqlalchemy import func, select

from app.core.database import SessionLocal, init_db
from app.core.models import (
    Department,
    KnowledgeUnit,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.core.rbac import ROLE_PRESETS
from app.core.security import hash_password

DEPARTMENTS = [
    (1, None, "云启科技", 0),
    (2, 1, "技术部", 1),
    (3, 2, "平台研发组", 1),
    (4, 1, "产品部", 2),
    (5, 1, "市场部", 3),
    (6, 1, "人力资源部", 4),
    (7, 1, "财务部", 5),
]

ROLES = [
    (1, "system_admin", "系统管理员", "平台全部菜单与操作权限", True),
    (2, "knowledge_admin", "知识管理员", "维护知识单元、导入文档、审核 FAQ 与知识缺口", False),
    (3, "normal_user", "普通用户", "AI 问答与授权知识", False),
    (4, "product_manager", "产品经理", "产品路线图与需求文档", False),
    (5, "finance_staff", "财务专员", "财务制度与报销规范", False),
    (6, "hr_partner", "HRBP", "人力资源业务伙伴", False),
]

USERS = [
    (1, "admin", "Admin@123", "系统管理员", 1, ["system_admin"]),
    (2, "km", "Km@12345", "林晓", 6, ["knowledge_admin"]),
    (3, "alice", "User@123", "陈思远", 2, ["normal_user"]),
    (4, "bob", "User@123", "李婉清", 5, ["normal_user"]),
    (5, "carol", "User@123", "赵子涵", 4, ["product_manager", "normal_user"]),
    (6, "david", "User@123", "周建国", 7, ["finance_staff", "normal_user"]),
    (7, "emma", "User@123", "林晓（HR）", 6, ["hr_partner", "normal_user"]),
]

LEADERS = {1: 1, 2: 3, 3: 3, 4: 5, 5: 4, 6: 7, 7: 6}

KNOWLEDGE_UNITS = [
    {
        "title": "员工手册（2026 版）",
        "category": "人力资源",
        "tags": "制度,入职,假期",
        "permissions": [{"target_type": "global", "target_id": None}],
        "content": """# 员工手册（2026 版）

## 入职与试用期
新员工入职当日完成劳动合同签署、工牌办理与账号开通。试用期一般为 3 至 6 个月，试用期薪酬为转正后的 80%。转正申请应在试用期结束前 10 个工作日由本人发起，直属主管与人力资源部共同评估。

## 考勤与假期
标准工作时间为 9:00 至 18:00，午休 12:00 至 13:30。年假：满 1 年 5 天，满 3 年 10 天，满 5 年 15 天，可顺延至次年 3 月 31 日。病假需提供二级以上医院证明；婚假 10 天，陪产假 15 天。

## 行为准则
遵守公司规章制度，维护公司声誉；对外发布涉及公司的信息须经品牌部门审核。""",
    },
    {
        "title": "费用报销管理规范",
        "category": "财务制度",
        "tags": "报销,发票,财务",
        "permissions": [{"target_type": "global", "target_id": None}],
        "content": """# 费用报销管理规范

## 报销流程
1. 费用发生后取得合法有效发票，抬头为公司全称；
2. 在 OA 填写报销单并上传发票；
3. 直属主管审批，单笔超过 5000 元需部门负责人二次审批；
4. 财务复核后，每周三、周五统一打款。

## 时限与发票
费用应在发生之日起 30 天内提交；电子发票需上传 PDF 原件并确保未重复报销；定额发票、手写收据不作为报销凭证。""",
    },
    {
        "title": "研发代码规范与发布流程",
        "category": "技术规范",
        "tags": "研发,代码,发布",
        "permissions": [{"target_type": "department", "target_id": 2}],
        "content": """# 研发代码规范与发布流程

## 分支与评审
主干为 main，开发分支 develop，功能分支 feature/xxx，线上问题 hotfix/xxx。所有合并请求至少 1 名同模块工程师评审，核心模块 2 名。

## 发布流程
提测 → 灰度观察 30 分钟 → 分批全量，每批间隔 10 分钟 → 发布后观察 2 小时。

## 回滚
出现 P0 级问题时立即回滚上一稳定版本，值班工程师执行并同步应急群，24 小时内提交复盘报告。""",
    },
    {
        "title": "VPN 与办公网络使用指南",
        "category": "技术规范",
        "tags": "VPN,网络,IT",
        "permissions": [{"target_type": "global", "target_id": None}],
        "content": """# VPN 与办公网络使用指南

## 申请流程
在 IT 服务台提交「VPN 权限申请」，选择使用场景与期限；直属主管审批后 1 个工作日内开通。外部合作方由对接人代为申请，有效期不超过 30 天。

## 常见问题
连接失败时检查本地网络与账号状态，切换接入节点；频繁掉线关闭节能模式并更新客户端。

## 安全要求
仅用于办公用途，禁止共享账号或在不可信环境接入。""",
    },
    {
        "title": "高管薪酬与股权激励方案（机密）",
        "category": "人力资源",
        "tags": "薪酬,股权,机密",
        "permissions": [{"target_type": "user", "target_id": 1}],
        "content": """# 高管薪酬与股权激励方案（机密）

## 薪酬结构
基本年薪、绩效年薪与长期激励三部分，绩效年薪占 40%，与年度经营目标完成率挂钩。

## 股权激励
限制性股票与期权组合，分四年归属，每年 25%；行权价格按授予日公允价值确定。

## 保密要求
仅限董事、高管与人力资源负责人知悉，禁止复制或外传。""",
    },
]


async def seed() -> bool:
    await init_db()
    async with SessionLocal() as db:
        existing = await db.scalar(select(func.count(User.id)))
        if existing:
            return False

        for department_id, parent_id, name, sort_order in DEPARTMENTS:
            db.add(
                Department(
                    id=department_id,
                    parent_id=parent_id,
                    name=name,
                    sort_order=sort_order,
                )
            )
        await db.flush()

        role_map: dict[str, Role] = {}
        for role_id, code, name, description, is_builtin in ROLES:
            role = Role(
                id=role_id,
                role_code=code,
                role_name=name,
                description=description,
                is_builtin=is_builtin,
            )
            db.add(role)
            role_map[code] = role
        await db.flush()

        for code, permission_codes in ROLE_PRESETS.items():
            role = role_map[code]
            for permission_code in permission_codes:
                permission_type = "menu" if permission_code.startswith("menu:") else "action"
                db.add(
                    RolePermission(
                        role_id=role.id,
                        permission_code=permission_code,
                        permission_type=permission_type,
                    )
                )

        user_map: dict[str, User] = {}
        for user_id, username, password, display_name, department_id, _roles in USERS:
            user = User(
                id=user_id,
                username=username,
                password_hash=hash_password(password),
                display_name=display_name,
                department_id=department_id,
                status="active",
            )
            db.add(user)
            user_map[username] = user
        await db.flush()

        for _user_id, username, _password, _display_name, _department_id, role_codes in USERS:
            for role_code in role_codes:
                db.add(UserRole(user_id=user_map[username].id, role_id=role_map[role_code].id))

        for department_id, leader_id in LEADERS.items():
            department = await db.get(Department, department_id)
            if department:
                department.leader_id = leader_id

        await db.commit()

        knowledge_count = await db.scalar(select(func.count(KnowledgeUnit.id)))
        if not knowledge_count:
            from app.knowledge.service import create_unit

            for item in KNOWLEDGE_UNITS:
                await create_unit(
                    db,
                    title=item["title"],
                    content=item["content"],
                    creator_id=2,
                    category=item["category"],
                    tags=item["tags"],
                    file_type="md",
                    permissions=item["permissions"],
                )
            await db.commit()

        return True


if __name__ == "__main__":
    created = asyncio.run(seed())
    print("种子数据已初始化" if created else "数据库已有用户，跳过初始化")
