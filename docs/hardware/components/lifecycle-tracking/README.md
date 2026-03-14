---
# LLM Optimization Metadata
metadata:
  document_id: hardware-components-lifecycle-tracking-README
  document_type: technical-reference
  target_audience:
    - intermediate
    - advanced
    - developers
    - hardware-engineers
  complexity_level: advanced
  estimated_read_time: 27 minutes
  last_updated: '2025-11-05'
  version: 1.0.0
tags:
  - hardware
  - specifications
  - electronics
  - components
key_entities:
  - 'NodeMCU ESP8266: WiFi communication bridge'
  - 'ZSX11H Motor Controllers: 36V, 350W brushless motor controllers'
  - 'Eve: AI assistant personality system'
summary:
  '> Comprehensive monitoring and management of component health, performance, and lifecycle This
  system tracks the complete lifecycle of all hardware components in the OmniTrek rover, from'
depends_on:
  - README.md
---

# Component Lifecycle Tracking

> Comprehensive monitoring and management of component health, performance, and lifecycle

## 📋 Overview

This system tracks the complete lifecycle of all hardware components in the OmniTrek rover, from
initial deployment through operational use, maintenance, and eventual replacement. It provides
predictive analytics, maintenance scheduling, and performance optimization recommendations.

In practice, the lifecycle tracker is intended to focus first on the **core rover hardware set**
defined in `docs/hardware/components/component-database.json` (controllers, motor drivers, and key
sensors). Additional components from the broader lab inventory can be added as needed, but component
IDs and categories should align with the entries in the component database for consistency.

## 🎯 Lifecycle Management Objectives

### **Health Monitoring**

- Real-time component health assessment
- Performance degradation detection
- Failure prediction and early warning
- Maintenance requirement identification

### **Performance Analytics**

- Usage pattern analysis
- Efficiency optimization tracking
- Load balancing recommendations
- Resource utilization monitoring

### **Maintenance Planning**

- Scheduled maintenance automation
- Component replacement forecasting
- Inventory management integration
- Cost optimization analysis

### **Compliance & Documentation**

- Regulatory compliance tracking
- Maintenance history logging
- Performance benchmarking
- Audit trail generation

## 🗂️ System Architecture

```text
lifecycle-tracking/
├── README.md                           # This file
├── tracking-system/                    # Core tracking application
│   ├── lifecycle-tracker.py            # Main tracking engine
│   ├── health-monitor.py               # Health assessment module
│   ├── performance-analyzer.py         # Performance analysis
│   ├── maintenance-scheduler.py        # Maintenance planning
│   └── predictive-analytics.py         # Failure prediction
├── data-models/                        # Data structures and schemas
│   ├── component-model.py              # Component data model
│   ├── lifecycle-events.py             # Event tracking
│   ├── performance-metrics.py          # Metrics definition
│   └── maintenance-records.py          # Maintenance logging
├── database/                           # Data storage and management
│   ├── schema.sql                      # Database schema
│   ├── migrations/                     # Database migrations
│   ├── seed-data/                      # Initial data
│   └── backup/                         # Database backups
├── api/                                # REST API for data access
│   ├── component-api.py                # Component endpoints
│   ├── metrics-api.py                  # Metrics endpoints
│   ├── maintenance-api.py              # Maintenance endpoints
│   └── analytics-api.py                # Analytics endpoints
├── web-interface/                      # Web dashboard
│   ├── dashboard.html                  # Main dashboard
│   ├── component-details.html          # Component view
│   ├── maintenance-schedule.html       # Maintenance calendar
│   └── analytics-reports.html          # Analytics reports
├── integration/                        # External system integration
│   ├── test-system-integration.py      # Connect to test framework
│   ├── inventory-integration.py        # Connect to inventory system
│   └── notification-integration.py     # Alert and notification system
└── reports/                            # Generated reports and analytics
    ├── lifecycle-reports/              # Component lifecycle reports
    ├── maintenance-reports/            # Maintenance summaries
    ├── performance-reports/            # Performance analytics
    └── compliance-reports/             # Compliance documentation
```

## 🔧 Core Tracking System

### **Lifecycle Tracker Engine**

```python
#!/usr/bin/env python3
"""
OmniTrek Component Lifecycle Tracker
Main engine for tracking component lifecycle events
"""

import time
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum

class ComponentStatus(Enum):
    DEPLOYED = "deployed"
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    MAINTENANCE_REQUIRED = "maintenance_required"
    FAILED = "failed"
    RETIRED = "retired"

class LifecycleEvent(Enum):
    DEPLOYMENT = "deployment"
    MAINTENANCE = "maintenance"
    PERFORMANCE_ISSUE = "performance_issue"
    FAILURE = "failure"
    REPLACEMENT = "replacement"
    CALIBRATION = "calibration"
    INSPECTION = "inspection"

@dataclass
class ComponentMetrics:
    """Component performance metrics"""
    component_id: str
    timestamp: datetime
    temperature: float
    voltage: float
    current: float
    utilization: float
    error_count: int
    uptime_hours: float
    performance_score: float

@dataclass
class LifecycleRecord:
    """Lifecycle event record"""
    component_id: str
    event_type: LifecycleEvent
    timestamp: datetime
    description: str
    severity: str
    technician: str
    cost: float
    downtime_hours: float
    resolution: str

class LifecycleTracker:
    """Main lifecycle tracking system"""

    def __init__(self, db_path: str = "lifecycle.db"):
        self.db_path = db_path
        self.init_database()
        self.components = {}
        self.active_monitors = {}

    def init_database(self):
        """Initialize database schema"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Components table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS components (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                deployment_date DATE,
                expected_lifespan INTEGER,
                current_status TEXT,
                last_maintenance DATE,
                total_cost REAL,
                uptime_hours REAL DEFAULT 0,
                failure_count INTEGER DEFAULT 0
            )
        ''')

        # Lifecycle events table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS lifecycle_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id TEXT,
                event_type TEXT,
                timestamp DATETIME,
                description TEXT,
                severity TEXT,
                technician TEXT,
                cost REAL,
                downtime_hours REAL,
                resolution TEXT,
                FOREIGN KEY (component_id) REFERENCES components (id)
            )
        ''')

        # Performance metrics table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id TEXT,
                timestamp DATETIME,
                temperature REAL,
                voltage REAL,
                current REAL,
                utilization REAL,
                error_count INTEGER,
                performance_score REAL,
                FOREIGN KEY (component_id) REFERENCES components (id)
            )
        ''')

        # Maintenance schedule table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS maintenance_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id TEXT,
                scheduled_date DATE,
                maintenance_type TEXT,
                description TEXT,
                estimated_cost REAL,
                estimated_duration REAL,
                status TEXT DEFAULT 'scheduled',
                FOREIGN KEY (component_id) REFERENCES components (id)
            )
        ''')

        conn.commit()
        conn.close()

    def register_component(self, component_data: Dict) -> bool:
        """Register a new component in the tracking system"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO components
                (id, name, category, deployment_date, expected_lifespan, current_status)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                component_data['id'],
                component_data['name'],
                component_data['category'],
                component_data.get('deployment_date', datetime.now().date()),
                component_data.get('expected_lifespan', 8760),  # Default 1 year in hours
                ComponentStatus.DEPLOYED.value
            ))

            # Record deployment event
            self.record_lifecycle_event(
                component_data['id'],
                LifecycleEvent.DEPLOYMENT,
                f"Component {component_data['name']} deployed to system",
                "INFO",
                "System",
                0.0,
                0.0,
                "Initial deployment successful"
            )

            conn.commit()
            conn.close()

            self.components[component_data['id']] = component_data
            return True

        except Exception as e:
            print(f"Failed to register component: {e}")
            return False

    def record_metrics(self, metrics: ComponentMetrics) -> bool:
        """Record component performance metrics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO performance_metrics
                (component_id, timestamp, temperature, voltage, current,
                 utilization, error_count, performance_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                metrics.component_id,
                metrics.timestamp,
                metrics.temperature,
                metrics.voltage,
                metrics.current,
                metrics.utilization,
                metrics.error_count,
                metrics.performance_score
            ))

            # Update component uptime
            cursor.execute('''
                UPDATE components
                SET uptime_hours = uptime_hours + ?
                WHERE id = ?
            ''', (1/3600, metrics.component_id))  # Convert seconds to hours

            conn.commit()
            conn.close()

            # Check for performance issues
            self.analyze_performance(metrics)

            return True

        except Exception as e:
            print(f"Failed to record metrics: {e}")
            return False

    def record_lifecycle_event(self, component_id: str, event_type: LifecycleEvent,
                              description: str, severity: str, technician: str,
                              cost: float, downtime_hours: float, resolution: str) -> bool:
        """Record a lifecycle event"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO lifecycle_events
                (component_id, event_type, timestamp, description, severity,
                 technician, cost, downtime_hours, resolution)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                component_id,
                event_type.value,
                datetime.now(),
                description,
                severity,
                technician,
                cost,
                downtime_hours,
                resolution
            ))

            # Update component status based on event
            if event_type == LifecycleEvent.FAILURE:
                self.update_component_status(component_id, ComponentStatus.FAILED)
            elif event_type == LifecycleEvent.MAINTENANCE:
                self.update_component_status(component_id, ComponentStatus.OPERATIONAL)

            # Update failure count and cost
            if event_type == LifecycleEvent.FAILURE:
                cursor.execute('''
                    UPDATE components
                    SET failure_count = failure_count + 1,
                        total_cost = total_cost + ?
                    WHERE id = ?
                ''', (cost, component_id))

            conn.commit()
            conn.close()

            return True

        except Exception as e:
            print(f"Failed to record lifecycle event: {e}")
            return False

    def analyze_performance(self, metrics: ComponentMetrics):
        """Analyze performance metrics and detect issues"""
        component_id = metrics.component_id

        # Get recent performance history
        recent_metrics = self.get_recent_metrics(component_id, hours=24)

        if len(recent_metrics) < 10:
            return  # Not enough data for analysis

        # Calculate performance trends
        avg_performance = sum(m.performance_score for m in recent_metrics) / len(recent_metrics)
        recent_performance = metrics.performance_score

        # Detect performance degradation
        if recent_performance < avg_performance * 0.8:
            self.record_lifecycle_event(
                component_id,
                LifecycleEvent.PERFORMANCE_ISSUE,
                f"Performance degradation detected: {recent_performance:.1f} vs {avg_performance:.1f} average",
                "WARNING",
                "System Monitor",
                0.0,
                0.0,
                "Investigation required"
            )

            self.update_component_status(component_id, ComponentStatus.DEGRADED)

        # Check for critical conditions
        if metrics.temperature > 80.0:
            self.record_lifecycle_event(
                component_id,
                LifecycleEvent.PERFORMANCE_ISSUE,
                f"High temperature detected: {metrics.temperature:.1f}°C",
                "CRITICAL",
                "System Monitor",
                0.0,
                0.0,
                "Immediate inspection required"
            )

        if metrics.error_count > 10:
            self.record_lifecycle_event(
                component_id,
                LifecycleEvent.PERFORMANCE_ISSUE,
                f"High error rate detected: {metrics.error_count} errors/hour",
                "WARNING",
                "System Monitor",
                0.0,
                0.0,
                "Diagnostic testing required"
            )

    def get_recent_metrics(self, component_id: str, hours: int = 24) -> List[ComponentMetrics]:
        """Get recent performance metrics for a component"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cutoff_time = datetime.now() - timedelta(hours=hours)

        cursor.execute('''
            SELECT component_id, timestamp, temperature, voltage, current,
                   utilization, error_count, performance_score
            FROM performance_metrics
            WHERE component_id = ? AND timestamp > ?
            ORDER BY timestamp DESC
        ''', (component_id, cutoff_time))

        metrics = []
        for row in cursor.fetchall():
            metrics.append(ComponentMetrics(
                component_id=row[0],
                timestamp=datetime.fromisoformat(row[1]),
                temperature=row[2],
                voltage=row[3],
                current=row[4],
                utilization=row[5],
                error_count=row[6],
                performance_score=row[7]
            ))

        conn.close()
        return metrics

    def update_component_status(self, component_id: str, status: ComponentStatus):
        """Update component status"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE components
            SET current_status = ?
            WHERE id = ?
        ''', (status.value, component_id))

        conn.commit()
        conn.close()

    def get_component_summary(self, component_id: str) -> Dict:
        """Get comprehensive component summary"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get component info
        cursor.execute('SELECT * FROM components WHERE id = ?', (component_id,))
        component = cursor.fetchone()

        if not component:
            return {}

        # Get recent metrics
        recent_metrics = self.get_recent_metrics(component_id, hours=24)

        # Get lifecycle events
        cursor.execute('''
            SELECT * FROM lifecycle_events
            WHERE component_id = ?
            ORDER BY timestamp DESC
            LIMIT 10
        ''', (component_id,))
        events = cursor.fetchall()

        # Get upcoming maintenance
        cursor.execute('''
            SELECT * FROM maintenance_schedule
            WHERE component_id = ? AND scheduled_date > ?
            ORDER BY scheduled_date ASC
            LIMIT 5
        ''', (component_id, datetime.now().date()))
        maintenance = cursor.fetchall()

        conn.close()

        return {
            "component": {
                "id": component[0],
                "name": component[1],
                "category": component[2],
                "deployment_date": component[3],
                "expected_lifespan": component[4],
                "current_status": component[5],
                "last_maintenance": component[6],
                "total_cost": component[7],
                "uptime_hours": component[8],
                "failure_count": component[9]
            },
            "recent_metrics": [asdict(m) for m in recent_metrics[-5:]],  # Last 5 metrics
            "recent_events": events,
            "upcoming_maintenance": maintenance,
            "health_score": self.calculate_health_score(component_id)
        }

    def calculate_health_score(self, component_id: str) -> float:
        """Calculate component health score (0-100)"""
        recent_metrics = self.get_recent_metrics(component_id, hours=24)

        if len(recent_metrics) < 5:
            return 50.0  # Insufficient data

        # Weight factors
        performance_weight = 0.4
        temperature_weight = 0.2
        error_weight = 0.2
        uptime_weight = 0.2

        # Performance score (already 0-100)
        avg_performance = sum(m.performance_score for m in recent_metrics) / len(recent_metrics)

        # Temperature score (optimal 20-60°C)
        avg_temp = sum(m.temperature for m in recent_metrics) / len(recent_metrics)
        if 20 <= avg_temp <= 60:
            temp_score = 100.0
        elif avg_temp < 20:
            temp_score = max(0, 100 - (20 - avg_temp) * 2)
        else:
            temp_score = max(0, 100 - (avg_temp - 60) * 2)

        # Error score (fewer errors is better)
        total_errors = sum(m.error_count for m in recent_metrics)
        error_score = max(0, 100 - total_errors * 5)

        # Uptime score (based on component age vs expected lifespan)
        component_info = self.get_component_info(component_id)
        if component_info:
            age_ratio = component_info['uptime_hours'] / component_info['expected_lifespan']
            uptime_score = max(0, 100 - age_ratio * 50)
        else:
            uptime_score = 50.0

        # Calculate weighted health score
        health_score = (
            avg_performance * performance_weight +
            temp_score * temperature_weight +
            error_score * error_weight +
            uptime_score * uptime_weight
        )

        return round(health_score, 1)

    def get_component_info(self, component_id: str) -> Optional[Dict]:
        """Get basic component information"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM components WHERE id = ?', (component_id,))
        component = cursor.fetchone()

        conn.close()

        if component:
            return {
                "id": component[0],
                "name": component[1],
                "category": component[2],
                "deployment_date": component[3],
                "expected_lifespan": component[4],
                "current_status": component[5],
                "last_maintenance": component[6],
                "total_cost": component[7],
                "uptime_hours": component[8],
                "failure_count": component[9]
            }
        return None

    def generate_lifecycle_report(self, component_id: str,
                                 start_date: datetime = None,
                                 end_date: datetime = None) -> Dict:
        """Generate comprehensive lifecycle report"""
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()

        component_summary = self.get_component_summary(component_id)

        # Get detailed metrics for the period
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM performance_metrics
            WHERE component_id = ? AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
        ''', (component_id, start_date, end_date))

        metrics_history = cursor.fetchall()

        cursor.execute('''
            SELECT * FROM lifecycle_events
            WHERE component_id = ? AND timestamp BETWEEN ? AND ?
            ORDER BY timestamp ASC
        ''', (component_id, start_date, end_date))

        events_history = cursor.fetchall()

        conn.close()

        # Calculate analytics
        total_downtime = sum(event[8] for event in events_history)
        total_maintenance_cost = sum(event[7] for event in events_history
                                   if event[2] == LifecycleEvent.MAINTENANCE.value)

        return {
            "component_summary": component_summary,
            "report_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "analytics": {
                "total_downtime_hours": total_downtime,
                "total_maintenance_cost": total_maintenance_cost,
                "metrics_count": len(metrics_history),
                "events_count": len(events_history),
                "health_trend": self.calculate_health_trend(component_id, start_date, end_date)
            },
            "detailed_history": {
                "metrics": metrics_history,
                "events": events_history
            }
        }

    def calculate_health_trend(self, component_id: str,
                              start_date: datetime, end_date: datetime) -> str:
        """Calculate health trend over time period"""
        # Get metrics at start and end of period
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT performance_score FROM performance_metrics
            WHERE component_id = ? AND timestamp >= ?
            ORDER BY timestamp ASC LIMIT 1
        ''', (component_id, start_date))

        start_score = cursor.fetchone()

        cursor.execute('''
            SELECT performance_score FROM performance_metrics
            WHERE component_id = ? AND timestamp <= ?
            ORDER BY timestamp DESC LIMIT 1
        ''', (component_id, end_date))

        end_score = cursor.fetchone()

        conn.close()

        if not start_score or not end_score:
            return "insufficient_data"

        start_val = start_score[0]
        end_val = end_score[0]

        if end_val > start_val * 1.1:
            return "improving"
        elif end_val < start_val * 0.9:
            return "declining"
        else:
            return "stable"
```

### **Predictive Analytics Module**

```python
#!/usr/bin/env python3
"""
Predictive Analytics for Component Lifecycle
Uses machine learning to predict failures and maintenance needs
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import json

class PredictiveAnalytics:
    """Predictive analytics for component failure prediction"""

    def __init__(self, model_path: str = "models/"):
        self.model_path = model_path
        self.models = {}
        self.scalers = {}
        self.feature_columns = [
            'temperature', 'voltage', 'current', 'utilization',
            'error_count', 'uptime_hours', 'age_hours', 'failure_count'
        ]

    def prepare_training_data(self, component_id: str,
                            days_back: int = 90) -> Tuple[pd.DataFrame, pd.Series]:
        """Prepare training data for machine learning"""
        # This would connect to the lifecycle tracker database
        # For demonstration, we'll create synthetic data

        # Generate synthetic features
        n_samples = days_back * 24  # Hourly samples

        np.random.seed(42)
        data = {
            'temperature': np.random.normal(45, 10, n_samples),
            'voltage': np.random.normal(5.0, 0.2, n_samples),
            'current': np.random.normal(1.5, 0.5, n_samples),
            'utilization': np.random.uniform(0.1, 0.9, n_samples),
            'error_count': np.random.poisson(2, n_samples),
            'uptime_hours': np.arange(n_samples),
            'age_hours': np.random.uniform(100, 8000, n_samples),
            'failure_count': np.random.exponential(0.1, n_samples).cumsum()
        }

        # Create failure labels (1 if failure occurs within next 24 hours)
        # Simulate failures based on stress conditions
        stress_score = (
            (data['temperature'] > 70) * 0.3 +
            (data['error_count'] > 5) * 0.3 +
            (data['age_hours'] > 7000) * 0.2 +
            (data['utilization'] > 0.8) * 0.2
        )

        failure_probability = 1 / (1 + np.exp(-5 * (stress_score - 0.5)))
        failures = np.random.random(n_samples) < failure_probability

        df = pd.DataFrame(data)
        labels = pd.Series(failures.astype(int))

        return df[self.feature_columns], labels

    def train_failure_prediction_model(self, component_id: str) -> Dict:
        """Train failure prediction model for a component"""
        X, y = self.prepare_training_data(component_id)

        if len(X) < 100:
            return {"status": "error", "message": "Insufficient training data"}

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # Train model
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            class_weight='balanced'
        )

        model.fit(X_train_scaled, y_train)

        # Evaluate model
        train_score = model.score(X_train_scaled, y_train)
        test_score = model.score(X_test_scaled, y_test)

        # Save model and scaler
        model_filename = f"{self.model_path}/failure_model_{component_id}.joblib"
        scaler_filename = f"{self.model_path}/scaler_{component_id}.joblib"

        joblib.dump(model, model_filename)
        joblib.dump(scaler, scaler_filename)

        self.models[component_id] = model
        self.scalers[component_id] = scaler

        return {
            "status": "success",
            "train_accuracy": train_score,
            "test_accuracy": test_score,
            "feature_importance": dict(zip(self.feature_columns, model.feature_importances_))
        }

    def predict_failure_risk(self, component_id: str,
                           current_metrics: Dict) -> Dict:
        """Predict failure risk for current component state"""
        if component_id not in self.models:
            # Try to load existing model
            try:
                model_filename = f"{self.model_path}/failure_model_{component_id}.joblib"
                scaler_filename = f"{self.model_path}/scaler_{component_id}.joblib"

                self.models[component_id] = joblib.load(model_filename)
                self.scalers[component_id] = joblib.load(scaler_filename)
            except:
                return {"status": "error", "message": "No trained model available"}

        # Prepare features
        features = np.array([[
            current_metrics.get('temperature', 45),
            current_metrics.get('voltage', 5.0),
            current_metrics.get('current', 1.5),
            current_metrics.get('utilization', 0.5),
            current_metrics.get('error_count', 0),
            current_metrics.get('uptime_hours', 1000),
            current_metrics.get('age_hours', 1000),
            current_metrics.get('failure_count', 0)
        ]])

        # Scale features
        features_scaled = self.scalers[component_id].transform(features)

        # Make prediction
        model = self.models[component_id]
        failure_probability = model.predict_proba(features_scaled)[0][1]

        # Determine risk level
        if failure_probability < 0.2:
            risk_level = "LOW"
        elif failure_probability < 0.5:
            risk_level = "MEDIUM"
        elif failure_probability < 0.8:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        return {
            "status": "success",
            "failure_probability": round(failure_probability, 3),
            "risk_level": risk_level,
            "prediction_timestamp": datetime.now().isoformat(),
            "recommendations": self.generate_recommendations(failure_probability, current_metrics)
        }

    def predict_maintenance_schedule(self, component_id: str) -> Dict:
        """Predict optimal maintenance schedule"""
        # Get component history and current state
        # This would integrate with the lifecycle tracker

        # For demonstration, return a predictive schedule
        current_date = datetime.now()

        # Predict next maintenance based on usage patterns
        days_until_maintenance = np.random.randint(7, 90)  # Random for demo

        predicted_maintenance_date = current_date + timedelta(days=days_until_maintenance)

        return {
            "component_id": component_id,
            "predicted_maintenance_date": predicted_maintenance_date.strftime("%Y-%m-%d"),
            "days_until_maintenance": days_until_maintenance,
            "confidence": round(np.random.uniform(0.7, 0.95), 2),
            "recommended_actions": [
                "Schedule visual inspection",
                "Check calibration accuracy",
                "Verify connection integrity",
                "Update firmware if available"
            ]
        }

    def generate_recommendations(self, failure_probability: float,
                                metrics: Dict) -> List[str]:
        """Generate maintenance recommendations based on risk assessment"""
        recommendations = []

        if failure_probability > 0.8:
            recommendations.extend([
                "IMMEDIATE INSPECTION REQUIRED",
                "Consider temporary shutdown",
                "Schedule emergency maintenance",
                "Prepare replacement component"
            ])
        elif failure_probability > 0.5:
            recommendations.extend([
                "Schedule inspection within 24 hours",
                "Monitor closely for next 48 hours",
                "Reduce operational load if possible",
                "Prepare maintenance plan"
            ])
        elif failure_probability > 0.2:
            recommendations.extend([
                "Schedule routine inspection",
                "Increase monitoring frequency",
                "Review maintenance history",
                "Check for environmental stressors"
            ])

        # Specific recommendations based on metrics
        if metrics.get('temperature', 0) > 70:
            recommendations.append("Check cooling system and ventilation")

        if metrics.get('error_count', 0) > 5:
            recommendations.append("Investigate error patterns and root causes")

        if metrics.get('utilization', 0) > 0.8:
            recommendations.append("Consider load balancing or performance optimization")

        if metrics.get('voltage', 5) < 4.5 or metrics.get('voltage', 5) > 5.5:
            recommendations.append("Check power supply and voltage regulation")

        return recommendations

    def analyze_component_trends(self, component_id: str,
                               days_back: int = 30) -> Dict:
        """Analyze performance trends and patterns"""
        # This would fetch real data from the lifecycle tracker
        # For demonstration, we'll analyze synthetic trends

        np.random.seed(42)
        dates = pd.date_range(end=datetime.now(), periods=days_back, freq='D')

        # Generate trend data
        performance_trend = np.linspace(85, 75, days_back) + np.random.normal(0, 5, days_back)
        temperature_trend = np.linspace(40, 55, days_back) + np.random.normal(0, 3, days_back)
        error_trend = np.cumsum(np.random.poisson(1, days_back))

        # Calculate trend directions
        performance_slope = np.polyfit(range(days_back), performance_trend, 1)[0]
        temperature_slope = np.polyfit(range(days_back), temperature_trend, 1)[0]

        return {
            "component_id": component_id,
            "analysis_period": f"{days_back} days",
            "trends": {
                "performance": {
                    "direction": "declining" if performance_slope < -0.1 else "stable" if abs(performance_slope) < 0.1 else "improving",
                    "slope": round(performance_slope, 3),
                    "current_value": round(performance_trend[-1], 1),
                    "change_percent": round(((performance_trend[-1] - performance_trend[0]) / performance_trend[0]) * 100, 1)
                },
                "temperature": {
                    "direction": "increasing" if temperature_slope > 0.1 else "stable" if abs(temperature_slope) < 0.1 else "decreasing",
                    "slope": round(temperature_slope, 3),
                    "current_value": round(temperature_trend[-1], 1),
                    "change_percent": round(((temperature_trend[-1] - temperature_trend[0]) / temperature_trend[0]) * 100, 1)
                },
                "errors": {
                    "total_period": int(error_trend[-1]),
                    "daily_average": round(error_trend[-1] / days_back, 1),
                    "trend": "increasing" if error_trend[-1] > error_trend[-7] * (7/days_back) else "stable"
                }
            },
            "recommendations": self.generate_trend_recommendations(performance_slope, temperature_slope, error_trend[-1])
        }

    def generate_trend_recommendations(self, performance_slope: float,
                                      temperature_slope: float,
                                      total_errors: int) -> List[str]:
        """Generate recommendations based on trend analysis"""
        recommendations = []

        if performance_slope < -0.5:
            recommendations.append("Performance declining significantly - investigate root cause")
        elif performance_slope < -0.1:
            recommendations.append("Performance showing decline - monitor closely")

        if temperature_slope > 0.3:
            recommendations.append("Temperature increasing - check cooling systems")
        elif temperature_slope > 0.1:
            recommendations.append("Temperature trending up - investigate heat sources")

        if total_errors > 50:
            recommendations.append("High error count - comprehensive diagnostic needed")
        elif total_errors > 20:
            recommendations.append("Elevated error rate - review error logs")

        if not recommendations:
            recommendations.append("All trends within normal parameters")

        return recommendations
```

### **Maintenance Scheduler**

```python
#!/usr/bin/env python3
"""
Maintenance Scheduler
Automated scheduling and management of component maintenance
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
from enum import Enum
import json

class MaintenanceType(Enum):
    ROUTINE_INSPECTION = "routine_inspection"
    CALIBRATION = "calibration"
    CLEANING = "cleaning"
    REPLACEMENT = "replacement"
    EMERGENCY = "emergency"
    UPGRADE = "upgrade"

class MaintenancePriority(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4
    EMERGENCY = 5

class MaintenanceScheduler:
    """Automated maintenance scheduling system"""

    def __init__(self, lifecycle_tracker):
        self.tracker = lifecycle_tracker
        self.scheduled_maintenance = []
        self.maintenance_history = []
        self.maintenance_rules = self.load_maintenance_rules()

    def load_maintenance_rules(self) -> Dict:
        """Load maintenance scheduling rules"""
        return {
            "arduino_mega": {
                "routine_inspection_interval": 30,  # days
                "calibration_interval": 90,
                "replacement_threshold": 0.7,  # health score
                "max_uptime_hours": 8760,  # 1 year
                "estimated_duration": {
                    "routine_inspection": 2.0,  # hours
                    "calibration": 1.5,
                    "replacement": 4.0
                },
                "estimated_cost": {
                    "routine_inspection": 50.0,
                    "calibration": 75.0,
                    "replacement": 200.0
                }
            },
            "esp32s": {
                "routine_inspection_interval": 30,
                "calibration_interval": 60,
                "replacement_threshold": 0.6,
                "max_uptime_hours": 7000,
                "estimated_duration": {
                    "routine_inspection": 1.5,
                    "calibration": 1.0,
                    "replacement": 3.0
                },
                "estimated_cost": {
                    "routine_inspection": 40.0,
                    "calibration": 60.0,
                    "replacement": 150.0
                }
            },
            "mpu6050": {
                "routine_inspection_interval": 14,
                "calibration_interval": 30,
                "replacement_threshold": 0.5,
                "max_uptime_hours": 4380,  # 6 months
                "estimated_duration": {
                    "routine_inspection": 0.5,
                    "calibration": 0.5,
                    "replacement": 1.0
                },
                "estimated_cost": {
                    "routine_inspection": 20.0,
                    "calibration": 30.0,
                    "replacement": 50.0
                }
            },
            "zsx11h": {
                "routine_inspection_interval": 21,
                "calibration_interval": 45,
                "replacement_threshold": 0.6,
                "max_uptime_hours": 6000,
                "estimated_duration": {
                    "routine_inspection": 1.0,
                    "calibration": 1.0,
                    "replacement": 2.0
                },
                "estimated_cost": {
                    "routine_inspection": 35.0,
                    "calibration": 50.0,
                    "replacement": 100.0
                }
            }
        }

    def schedule_maintenance(self, component_id: str, maintenance_type: MaintenanceType,
                           scheduled_date: datetime, priority: MaintenancePriority = MaintenancePriority.MEDIUM,
                           description: str = "") -> bool:
        """Schedule maintenance for a component"""
        try:
            # Check if maintenance is already scheduled
            if self.is_maintenance_scheduled(component_id, maintenance_type):
                return False

            # Create maintenance record
            maintenance_record = {
                "id": len(self.scheduled_maintenance) + 1,
                "component_id": component_id,
                "maintenance_type": maintenance_type.value,
                "scheduled_date": scheduled_date.isoformat(),
                "priority": priority.value,
                "description": description or f"Scheduled {maintenance_type.value}",
                "status": "scheduled",
                "created_date": datetime.now().isoformat(),
                "estimated_duration": self.get_estimated_duration(component_id, maintenance_type),
                "estimated_cost": self.get_estimated_cost(component_id, maintenance_type)
            }

            self.scheduled_maintenance.append(maintenance_record)

            # Save to database
            self.save_maintenance_schedule(maintenance_record)

            return True

        except Exception as e:
            print(f"Failed to schedule maintenance: {e}")
            return False

    def generate_maintenance_schedule(self, days_ahead: int = 90) -> List[Dict]:
        """Generate proactive maintenance schedule"""
        schedule = []
        current_date = datetime.now()

        # Get all components
        components = self.get_all_components()

        for component in components:
            component_id = component['id']
            component_category = component['category']

            # Get component health and usage info
            health_score = self.tracker.calculate_health_score(component_id)
            component_info = self.tracker.get_component_info(component_id)

            if not component_info:
                continue

            # Get maintenance rules for this component type
            rules = self.maintenance_rules.get(component_category, {})

            # Schedule routine inspection
            if "routine_inspection_interval" in rules:
                last_inspection = component_info.get('last_maintenance')
                if last_inspection:
                    last_inspection_date = datetime.fromisoformat(last_inspection)
                    days_since_inspection = (current_date - last_inspection_date).days
                    next_inspection_days = rules["routine_inspection_interval"] - days_since_inspection
                else:
                    next_inspection_days = rules["routine_inspection_interval"]

                if next_inspection_days <= days_ahead:
                    scheduled_date = current_date + timedelta(days=next_inspection_days)
                    priority = self.calculate_maintenance_priority(
                        health_score, next_inspection_days, MaintenanceType.ROUTINE_INSPECTION
                    )

                    schedule.append({
                        "component_id": component_id,
                        "maintenance_type": MaintenanceType.ROUTINE_INSPECTION.value,
                        "scheduled_date": scheduled_date.isoformat(),
                        "priority": priority.value,
                        "reason": "Routine inspection due"
                    })

            # Schedule calibration
            if "calibration_interval" in rules:
                last_calibration = self.get_last_maintenance_date(component_id, MaintenanceType.CALIBRATION)
                if last_calibration:
                    days_since_calibration = (current_date - last_calibration).days
                    next_calibration_days = rules["calibration_interval"] - days_since_calibration
                else:
                    next_calibration_days = rules["calibration_interval"]

                if next_calibration_days <= days_ahead:
                    scheduled_date = current_date + timedelta(days=next_calibration_days)
                    priority = self.calculate_maintenance_priority(
                        health_score, next_calibration_days, MaintenanceType.CALIBRATION
                    )

                    schedule.append({
                        "component_id": component_id,
                        "maintenance_type": MaintenanceType.CALIBRATION.value,
                        "scheduled_date": scheduled_date.isoformat(),
                        "priority": priority.value,
                        "reason": "Calibration due"
                    })

            # Check for replacement based on health score
            if "replacement_threshold" in rules and health_score < rules["replacement_threshold"]:
                scheduled_date = current_date + timedelta(days=7)  # Schedule within 1 week
                priority = MaintenancePriority.HIGH if health_score < 0.4 else MaintenancePriority.MEDIUM

                schedule.append({
                    "component_id": component_id,
                    "maintenance_type": MaintenanceType.REPLACEMENT.value,
                    "scheduled_date": scheduled_date.isoformat(),
                    "priority": priority.value,
                    "reason": f"Low health score: {health_score}"
                })

            # Check for replacement based on uptime
            if "max_uptime_hours" in rules:
                uptime_hours = component_info.get('uptime_hours', 0)
                if uptime_hours > rules["max_uptime_hours"] * 0.9:  # 90% of max lifespan
                    scheduled_date = current_date + timedelta(days=14)  # Schedule within 2 weeks
                    priority = MaintenancePriority.HIGH

                    schedule.append({
                        "component_id": component_id,
                        "maintenance_type": MaintenanceType.REPLACEMENT.value,
                        "scheduled_date": scheduled_date.isoformat(),
                        "priority": priority.value,
                        "reason": f"Approaching end of life: {uptime_hours} hours"
                    })

        # Sort schedule by date and priority
        schedule.sort(key=lambda x: (x['scheduled_date'], -x['priority']))

        return schedule

    def calculate_maintenance_priority(self, health_score: float, days_until: int,
                                     maintenance_type: MaintenanceType) -> MaintenancePriority:
        """Calculate maintenance priority based on health and urgency"""
        if maintenance_type == MaintenanceType.EMERGENCY:
            return MaintenancePriority.EMERGENCY

        if health_score < 0.3:
            return MaintenancePriority.CRITICAL
        elif health_score < 0.5:
            return MaintenancePriority.HIGH
        elif days_until < 7:
            return MaintenancePriority.HIGH
        elif days_until < 30:
            return MaintenancePriority.MEDIUM
        else:
            return MaintenancePriority.LOW

    def get_upcoming_maintenance(self, days: int = 30) -> List[Dict]:
        """Get upcoming maintenance for next N days"""
        current_date = datetime.now()
        cutoff_date = current_date + timedelta(days=days)

        upcoming = []
        for maintenance in self.scheduled_maintenance:
            maintenance_date = datetime.fromisoformat(maintenance['scheduled_date'])
            if current_date <= maintenance_date <= cutoff_date:
                upcoming.append(maintenance)

        return sorted(upcoming, key=lambda x: x['scheduled_date'])

    def complete_maintenance(self, maintenance_id: int, technician: str,
                           actual_duration: float, actual_cost: float,
                           notes: str = "") -> bool:
        """Mark maintenance as completed"""
        try:
            # Find maintenance record
            maintenance = None
            for m in self.scheduled_maintenance:
                if m['id'] == maintenance_id:
                    maintenance = m
                    break

            if not maintenance:
                return False

            # Update status
            maintenance['status'] = 'completed'
            maintenance['completed_date'] = datetime.now().isoformat()
            maintenance['technician'] = technician
            maintenance['actual_duration'] = actual_duration
            maintenance['actual_cost'] = actual_cost
            maintenance['notes'] = notes

            # Move to history
            self.maintenance_history.append(maintenance)
            self.scheduled_maintenance.remove(maintenance)

            # Update component last maintenance date
            self.update_component_maintenance_date(
                maintenance['component_id'],
                maintenance['maintenance_type']
            )

            # Record lifecycle event
            self.tracker.record_lifecycle_event(
                maintenance['component_id'],
                LifecycleEvent.MAINTENANCE,
                f"{maintenance['maintenance_type']} completed",
                "INFO",
                technician,
                actual_cost,
                actual_duration,
                notes or "Maintenance completed successfully"
            )

            return True

        except Exception as e:
            print(f"Failed to complete maintenance: {e}")
            return False

    def get_maintenance_calendar(self, year: int, month: int) -> Dict:
        """Get maintenance calendar for a specific month"""
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)

        calendar_events = []

        for maintenance in self.scheduled_maintenance:
            maintenance_date = datetime.fromisoformat(maintenance['scheduled_date'])
            if start_date <= maintenance_date <= end_date:
                calendar_events.append({
                    "date": maintenance_date.strftime("%Y-%m-%d"),
                    "component_id": maintenance['component_id'],
                    "type": maintenance['maintenance_type'],
                    "priority": maintenance['priority'],
                    "estimated_duration": maintenance['estimated_duration'],
                    "estimated_cost": maintenance['estimated_cost']
                })

        return {
            "year": year,
            "month": month,
            "events": calendar_events,
            "summary": {
                "total_events": len(calendar_events),
                "total_estimated_cost": sum(e['estimated_cost'] for e in calendar_events),
                "total_estimated_duration": sum(e['estimated_duration'] for e in calendar_events)
            }
        }

    def get_maintenance_metrics(self, days_back: int = 30) -> Dict:
        """Get maintenance performance metrics"""
        cutoff_date = datetime.now() - timedelta(days=days_back)

        recent_maintenance = [
            m for m in self.maintenance_history
            if datetime.fromisoformat(m['completed_date']) > cutoff_date
        ]

        if not recent_maintenance:
            return {"message": "No maintenance data available for the specified period"}

        total_cost = sum(m.get('actual_cost', 0) for m in recent_maintenance)
        total_duration = sum(m.get('actual_duration', 0) for m in recent_maintenance)

        # Calculate on-time completion rate
        on_time_count = 0
        for m in recent_maintenance:
            scheduled_date = datetime.fromisoformat(m['scheduled_date'])
            completed_date = datetime.fromisoformat(m['completed_date'])
            if completed_date <= scheduled_date + timedelta(days=1):  # Within 1 day
                on_time_count += 1

        on_time_rate = (on_time_count / len(recent_maintenance)) * 100

        # Maintenance type breakdown
        type_counts = {}
        for m in recent_maintenance:
            maint_type = m['maintenance_type']
            type_counts[maint_type] = type_counts.get(maint_type, 0) + 1

        return {
            "period": f"{days_back} days",
            "total_maintenance_events": len(recent_maintenance),
            "total_cost": round(total_cost, 2),
            "total_downtime_hours": round(total_duration, 2),
            "on_time_completion_rate": round(on_time_rate, 1),
            "average_cost_per_event": round(total_cost / len(recent_maintenance), 2),
            "average_duration_per_event": round(total_duration / len(recent_maintenance), 2),
            "maintenance_type_breakdown": type_counts
        }

    # Helper methods (would connect to database in real implementation)
    def get_all_components(self) -> List[Dict]:
        """Get all components from the system"""
        # This would query the lifecycle tracker database
        return [
            {"id": "arduino-mega-2560", "category": "arduino_mega"},
            {"id": "nodemcu-esp32s", "category": "esp32s"},
            {"id": "mpu-6050", "category": "mpu6050"},
            {"id": "riorand-zsx11h", "category": "zsx11h"}
        ]

    def is_maintenance_scheduled(self, component_id: str, maintenance_type: MaintenanceType) -> bool:
        """Check if maintenance is already scheduled"""
        for m in self.scheduled_maintenance:
            if (m['component_id'] == component_id and
                m['maintenance_type'] == maintenance_type.value and
                m['status'] == 'scheduled'):
                return True
        return False

    def get_estimated_duration(self, component_id: str, maintenance_type: MaintenanceType) -> float:
        """Get estimated maintenance duration"""
        component_info = self.tracker.get_component_info(component_id)
        if not component_info:
            return 2.0  # Default

        category = component_info['category']
        rules = self.maintenance_rules.get(category, {})
        durations = rules.get('estimated_duration', {})
        return durations.get(maintenance_type.value, 2.0)

    def get_estimated_cost(self, component_id: str, maintenance_type: MaintenanceType) -> float:
        """Get estimated maintenance cost"""
        component_info = self.tracker.get_component_info(component_id)
        if not component_info:
            return 100.0  # Default

        category = component_info['category']
        rules = self.maintenance_rules.get(category, {})
        costs = rules.get('estimated_cost', {})
        return costs.get(maintenance_type.value, 100.0)

    def save_maintenance_schedule(self, maintenance_record: Dict):
        """Save maintenance schedule to database"""
        # This would save to the lifecycle tracker database
        pass

    def get_last_maintenance_date(self, component_id: str, maintenance_type: MaintenanceType) -> Optional[datetime]:
        """Get last maintenance date for a specific type"""
        for m in self.maintenance_history:
            if (m['component_id'] == component_id and
                m['maintenance_type'] == maintenance_type.value):
                return datetime.fromisoformat(m['completed_date'])
        return None

    def update_component_maintenance_date(self, component_id: str, maintenance_type: str):
        """Update component's last maintenance date"""
        # This would update the lifecycle tracker database
        pass
```

## 📊 Web Dashboard Interface

### **Main Dashboard HTML**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OmniTrek Component Lifecycle Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: #f5f7fa;
        color: #2c3e50;
      }

      .dashboard {
        max-width: 1400px;
        margin: 0 auto;
        padding: 20px;
      }

      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px;
        border-radius: 15px;
        margin-bottom: 30px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      }

      .header h1 {
        font-size: 2.5em;
        margin-bottom: 10px;
      }

      .header p {
        font-size: 1.1em;
        opacity: 0.9;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }

      .metric-card {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
        text-align: center;
        transition: transform 0.3s ease;
      }

      .metric-card:hover {
        transform: translateY(-5px);
      }

      .metric-value {
        font-size: 2.5em;
        font-weight: bold;
        color: #3498db;
        margin-bottom: 10px;
      }

      .metric-label {
        font-size: 1.1em;
        color: #7f8c8d;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .metric-change {
        font-size: 0.9em;
        margin-top: 10px;
        padding: 5px 10px;
        border-radius: 20px;
        display: inline-block;
      }

      .positive {
        background: #d5f4e6;
        color: #27ae60;
      }

      .negative {
        background: #fadbd8;
        color: #e74c3c;
      }

      .content-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
      }

      .chart-container {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
      }

      .chart-title {
        font-size: 1.3em;
        font-weight: 600;
        margin-bottom: 20px;
        color: #2c3e50;
      }

      .components-list {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
      }

      .component-item {
        padding: 15px;
        border-bottom: 1px solid #ecf0f1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background 0.3s ease;
      }

      .component-item:hover {
        background: #f8f9fa;
      }

      .component-item:last-child {
        border-bottom: none;
      }

      .component-info {
        flex: 1;
      }

      .component-name {
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 5px;
      }

      .component-status {
        font-size: 0.9em;
        color: #7f8c8d;
      }

      .health-score {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 0.9em;
      }

      .health-excellent {
        background: #27ae60;
      }
      .health-good {
        background: #3498db;
      }
      .health-fair {
        background: #f39c12;
      }
      .health-poor {
        background: #e74c3c;
      }

      .maintenance-schedule {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
      }

      .schedule-item {
        padding: 15px;
        border-left: 4px solid #3498db;
        margin-bottom: 15px;
        background: #f8f9fa;
        border-radius: 0 8px 8px 0;
      }

      .schedule-date {
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 5px;
      }

      .schedule-details {
        font-size: 0.9em;
        color: #7f8c8d;
      }

      .priority-high {
        border-left-color: #e74c3c;
      }

      .priority-medium {
        border-left-color: #f39c12;
      }

      .priority-low {
        border-left-color: #27ae60;
      }

      .alerts-container {
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
      }

      .alert-item {
        padding: 15px;
        margin-bottom: 15px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 15px;
      }

      .alert-critical {
        background: #fadbd8;
        border-left: 4px solid #e74c3c;
      }

      .alert-warning {
        background: #fef9e7;
        border-left: 4px solid #f39c12;
      }

      .alert-info {
        background: #eaf2f8;
        border-left: 4px solid #3498db;
      }

      .alert-icon {
        font-size: 1.5em;
      }

      .alert-content {
        flex: 1;
      }

      .alert-title {
        font-weight: 600;
        color: #2c3e50;
        margin-bottom: 5px;
      }

      .alert-message {
        font-size: 0.9em;
        color: #7f8c8d;
      }

      @media (max-width: 1024px) {
        .content-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 768px) {
        .metrics-grid {
          grid-template-columns: 1fr;
        }

        .dashboard {
          padding: 10px;
        }
      }
    </style>
  </head>
  <body>
    <div class="dashboard">
      <div class="header">
        <h1>OmniTrek Component Lifecycle</h1>
        <p>Real-time monitoring and predictive maintenance dashboard</p>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value" id="total-components">10</div>
          <div class="metric-label">Total Components</div>
          <div class="metric-change positive">+2 this month</div>
        </div>

        <div class="metric-card">
          <div class="metric-value" id="operational-components">8</div>
          <div class="metric-label">Operational</div>
          <div class="metric-change positive">100% uptime</div>
        </div>

        <div class="metric-card">
          <div class="metric-value" id="maintenance-required">2</div>
          <div class="metric-label">Maintenance Required</div>
          <div class="metric-change negative">+1 this week</div>
        </div>

        <div class="metric-card">
          <div class="metric-value" id="avg-health-score">87%</div>
          <div class="metric-label">Average Health</div>
          <div class="metric-change positive">+3% this month</div>
        </div>
      </div>

      <div class="content-grid">
        <div class="chart-container">
          <h3 class="chart-title">Component Health Trends</h3>
          <canvas id="healthTrendsChart" width="400" height="200"></canvas>
        </div>

        <div class="components-list">
          <h3 class="chart-title">Component Status</h3>
          <div id="components-list">
            <!-- Components will be populated here -->
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="maintenance-schedule">
          <h3 class="chart-title">Upcoming Maintenance</h3>
          <div id="maintenance-schedule">
            <!-- Maintenance items will be populated here -->
          </div>
        </div>

        <div class="alerts-container">
          <h3 class="chart-title">System Alerts</h3>
          <div id="alerts-container">
            <!-- Alerts will be populated here -->
          </div>
        </div>
      </div>
    </div>

    <script>
      // Initialize dashboard
      document.addEventListener('DOMContentLoaded', function () {
        loadDashboardData();
        initializeCharts();
        setupAutoRefresh();
      });

      function loadDashboardData() {
        // Load components data
        fetch('/api/components/summary')
          .then(response => response.json())
          .then(data => {
            updateComponentsList(data.components);
            updateMetrics(data.metrics);
          })
          .catch(error => console.error('Error loading components:', error));

        // Load maintenance schedule
        fetch('/api/maintenance/upcoming')
          .then(response => response.json())
          .then(data => {
            updateMaintenanceSchedule(data.maintenance);
          })
          .catch(error => console.error('Error loading maintenance:', error));

        // Load alerts
        fetch('/api/alerts/active')
          .then(response => response.json())
          .then(data => {
            updateAlerts(data.alerts);
          })
          .catch(error => console.error('Error loading alerts:', error));
      }

      function updateComponentsList(components) {
        const container = document.getElementById('components-list');
        container.innerHTML = '';

        components.forEach(component => {
          const healthClass = getHealthClass(component.health_score);
          const statusIcon = getStatusIcon(component.current_status);

          const item = document.createElement('div');
          item.className = 'component-item';
          item.innerHTML = `
                    <div class="component-info">
                        <div class="component-name">${component.name}</div>
                        <div class="component-status">${statusIcon} ${component.current_status}</div>
                    </div>
                    <div class="health-score ${healthClass}">
                        ${component.health_score}%
                    </div>
                `;

          container.appendChild(item);
        });
      }

      function updateMaintenanceSchedule(maintenance) {
        const container = document.getElementById('maintenance-schedule');
        container.innerHTML = '';

        maintenance.slice(0, 5).forEach(item => {
          const priorityClass = `priority-${item.priority.toLowerCase()}`;
          const date = new Date(item.scheduled_date).toLocaleDateString();

          const scheduleItem = document.createElement('div');
          scheduleItem.className = `schedule-item ${priorityClass}`;
          scheduleItem.innerHTML = `
                    <div class="schedule-date">${date}</div>
                    <div class="schedule-details">
                        <strong>${item.component_name}</strong><br>
                        ${item.maintenance_type.replace('_', ' ').toUpperCase()}
                    </div>
                `;

          container.appendChild(scheduleItem);
        });
      }

      function updateAlerts(alerts) {
        const container = document.getElementById('alerts-container');
        container.innerHTML = '';

        alerts.slice(0, 5).forEach(alert => {
          const alertClass = `alert-${alert.severity.toLowerCase()}`;
          const icon = getAlertIcon(alert.severity);

          const alertItem = document.createElement('div');
          alertItem.className = `alert-item ${alertClass}`;
          alertItem.innerHTML = `
                    <div class="alert-icon">${icon}</div>
                    <div class="alert-content">
                        <div class="alert-title">${alert.title}</div>
                        <div class="alert-message">${alert.message}</div>
                    </div>
                `;

          container.appendChild(alertItem);
        });
      }

      function updateMetrics(metrics) {
        document.getElementById('total-components').textContent = metrics.total_components;
        document.getElementById('operational-components').textContent = metrics.operational;
        document.getElementById('maintenance-required').textContent = metrics.maintenance_required;
        document.getElementById('avg-health-score').textContent = metrics.avg_health_score + '%';
      }

      function initializeCharts() {
        // Health trends chart
        const ctx = document.getElementById('healthTrendsChart').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
              {
                label: 'Average Health Score',
                data: [85, 87, 86, 88, 87, 89],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                fill: true,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: false,
                min: 70,
                max: 100,
                ticks: {
                  callback: function (value) {
                    return value + '%';
                  },
                },
              },
            },
            plugins: {
              legend: {
                display: false,
              },
            },
          },
        });
      }

      function setupAutoRefresh() {
        // Refresh data every 30 seconds
        setInterval(loadDashboardData, 30000);
      }

      function getHealthClass(score) {
        if (score >= 90) return 'health-excellent';
        if (score >= 75) return 'health-good';
        if (score >= 60) return 'health-fair';
        return 'health-poor';
      }

      function getStatusIcon(status) {
        const icons = {
          operational: '✅',
          degraded: '⚠️',
          maintenance_required: '🔧',
          failed: '❌',
          retired: '📦',
        };
        return icons[status] || '❓';
      }

      function getAlertIcon(severity) {
        const icons = {
          critical: '🚨',
          warning: '⚠️',
          info: 'ℹ️',
        };
        return icons[severity] || 'ℹ️';
      }
    </script>
  </body>
</html>
```

## 🚀 Getting Started

### **Installation & Setup**

```bash
# Clone the repository
git clone https://github.com/omnitrek/lifecycle-tracking.git
cd lifecycle-tracking

# Install Python dependencies
pip install -r requirements.txt

# Initialize database
python -m database.init_db

# Load component data
python -m data.load_components

# Start the tracking service
python -m tracking_system.lifecycle_tracker

# Start the web interface
python -m web_interface.app
```

### **Configuration**

```json
{
  "database": {
    "path": "data/lifecycle.db",
    "backup_interval": 3600,
    "max_backups": 10
  },
  "monitoring": {
    "metrics_interval": 60,
    "health_check_interval": 300,
    "alert_thresholds": {
      "temperature": 80.0,
      "error_rate": 10,
      "health_score": 60.0
    }
  },
  "predictions": {
    "model_retrain_interval": 7,
    "prediction_horizon": 30,
    "confidence_threshold": 0.7
  },
  "maintenance": {
    "auto_schedule": true,
    "notification_lead_time": 72,
    "cost_tracking": true
  }
}
```

---

**Last Updated**: 2025-11-05 **System Version**: 1.0.0 **Technology**: Python 3.8+, SQLite, Machine
Learning

This comprehensive lifecycle tracking system provides predictive maintenance, real-time health
monitoring, and automated scheduling to ensure optimal performance and reliability of all OmniTrek
rover components.
