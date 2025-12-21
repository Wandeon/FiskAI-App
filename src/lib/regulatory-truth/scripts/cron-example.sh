#!/bin/bash
# Example cron configuration for Regulatory Truth Layer monitoring
# Add to crontab with: crontab -e

# Set working directory
FISKAI_DIR="/home/admin/FiskAI"
LOG_DIR="/home/admin/FiskAI/logs/regulatory-truth"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# =============================================================================
# DAILY: T0 Critical Sources (6 AM daily)
# =============================================================================
# 0 6 * * * cd $FISKAI_DIR && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T0 --pipeline >> $LOG_DIR/monitor-t0.log 2>&1

# =============================================================================
# WEEKLY: T1 High Priority Sources (7 AM every Monday)
# =============================================================================
# 0 7 * * 1 cd $FISKAI_DIR && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T1 --pipeline >> $LOG_DIR/monitor-t1.log 2>&1

# =============================================================================
# MONTHLY: T2/T3 Medium/Low Priority Sources (8 AM on 1st of month)
# =============================================================================
# 0 8 1 * * cd $FISKAI_DIR && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T2 --pipeline >> $LOG_DIR/monitor-t2.log 2>&1

# =============================================================================
# HOURLY: Check all sources (for high-frequency monitoring)
# Only use this if you want to check sources more frequently
# =============================================================================
# 0 * * * * cd $FISKAI_DIR && npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --max=10 >> $LOG_DIR/monitor-hourly.log 2>&1

# =============================================================================
# LOG ROTATION: Clean old logs (runs at midnight)
# =============================================================================
# 0 0 * * * find $LOG_DIR -name "*.log" -mtime +30 -delete

# =============================================================================
# EXAMPLE SYSTEMD SERVICE (alternative to cron)
# =============================================================================
# Create file: /etc/systemd/system/fiskai-monitor-t0.service
#
# [Unit]
# Description=FiskAI Regulatory Truth Monitoring (T0 Critical)
# After=network.target postgresql.service
#
# [Service]
# Type=oneshot
# User=admin
# WorkingDirectory=/home/admin/FiskAI
# ExecStart=/usr/bin/npx tsx src/lib/regulatory-truth/scripts/monitor.ts -- --priority=T0 --pipeline
# StandardOutput=append:/home/admin/FiskAI/logs/regulatory-truth/monitor-t0.log
# StandardError=append:/home/admin/FiskAI/logs/regulatory-truth/monitor-t0.log
#
# [Install]
# WantedBy=multi-user.target

# Create timer: /etc/systemd/system/fiskai-monitor-t0.timer
#
# [Unit]
# Description=FiskAI Regulatory Truth Monitoring Timer (T0 Critical - Daily)
#
# [Timer]
# OnCalendar=daily
# OnCalendar=06:00
# Persistent=true
#
# [Install]
# WantedBy=timers.target

# Then enable and start:
# sudo systemctl daemon-reload
# sudo systemctl enable fiskai-monitor-t0.timer
# sudo systemctl start fiskai-monitor-t0.timer
# sudo systemctl status fiskai-monitor-t0.timer
