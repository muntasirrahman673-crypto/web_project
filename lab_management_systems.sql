-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 13, 2026 at 06:38 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `lab_management_systems`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `action_time` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `action_time`) VALUES
(1, 1, 'Approved user ID: 5', '2026-06-10 16:45:39'),
(2, 1, 'Approved user ID: 6', '2026-06-11 07:01:12'),
(3, 6, 'Created booking for equipment ID: 5', '2026-06-11 09:23:41'),
(4, 2, 'Updated booking 1 to approved', '2026-06-11 09:28:09'),
(5, 6, 'Created booking for equipment ID: 2', '2026-06-12 12:45:01'),
(6, 2, 'Updated booking 2 to approved', '2026-06-12 12:45:46'),
(7, 5, 'Created booking for equipment ID: 5', '2026-06-12 16:04:25'),
(8, 2, 'Updated booking 3 to approved', '2026-06-12 16:06:06');

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `equipment_id` int(11) NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `purpose` text DEFAULT NULL,
  `status` enum('pending','approved','rejected','cancelled') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `user_id`, `equipment_id`, `start_time`, `end_time`, `purpose`, `status`, `created_at`, `reviewed_by`, `reviewed_at`) VALUES
(1, 6, 5, '2026-06-11 09:22:00', '2026-06-12 09:22:00', 'for knowledge', 'approved', '2026-06-11 09:23:41', 2, '2026-06-11 09:28:09'),
(2, 6, 2, '2026-06-12 12:44:00', '2026-06-13 12:44:00', 'we want to see this', 'approved', '2026-06-12 12:45:01', 2, '2026-06-12 12:45:46'),
(3, 5, 5, '2026-06-12 16:03:00', '2026-06-13 16:03:00', 'Implement this for assignment 2 .', 'approved', '2026-06-12 16:04:25', 2, '2026-06-12 16:06:06');

--
-- Triggers `bookings`
--
DELIMITER $$
CREATE TRIGGER `log_booking_creation` AFTER INSERT ON `bookings` FOR EACH ROW BEGIN
    INSERT INTO activity_logs (user_id, action) 
    VALUES (NEW.user_id, CONCAT('Created booking for equipment ID: ', NEW.equipment_id));
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `update_equipment_usage` AFTER UPDATE ON `bookings` FOR EACH ROW BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        UPDATE equipment 
        SET usage_count = usage_count + 1 
        WHERE id = NEW.equipment_id;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `damage_reports`
--

CREATE TABLE `damage_reports` (
  `id` int(11) NOT NULL,
  `equipment_id` int(11) NOT NULL,
  `reported_by` int(11) NOT NULL,
  `severity` enum('low','medium','high','minor','major') NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('pending','resolved','rejected') DEFAULT 'pending',
  `reported_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolution_notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `damage_reports`
--

INSERT INTO `damage_reports` (`id`, `equipment_id`, `reported_by`, `severity`, `description`, `status`, `reported_at`, `resolved_at`, `resolution_notes`) VALUES
(1, 2, 2, 'high', 'happpend dd', 'resolved', '2026-06-11 07:55:30', NULL, NULL),
(2, 5, 6, 'high', 'when use this', 'resolved', '2026-06-11 14:27:05', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `equipment`
--

CREATE TABLE `equipment` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `status` enum('available','inuse','maintenance') DEFAULT 'available',
  `description` text DEFAULT NULL,
  `usage_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `equipment`
--

INSERT INTO `equipment` (`id`, `name`, `category`, `location`, `status`, `description`, `usage_count`, `created_at`) VALUES
(1, 'High-Resolution Microscope', 'Imaging', 'Lab A-101', 'available', 'Advanced microscope with 1000x zoom capability', 0, '2026-06-08 08:12:26'),
(2, 'Centrifuge X-20', 'Sample Preparation', 'Lab B-203', 'inuse', 'High speed centrifuge up to 15000 RPM', 1, '2026-06-08 08:12:26'),
(3, 'UV Spectrophotometer', 'Analysis', 'Lab C-305', 'available', 'Spectral analysis device for DNA/Protein quantification', 0, '2026-06-08 08:12:26'),
(4, 'PCR Thermal Cycler', 'Molecular Biology', 'Lab A-102', 'available', 'DNA amplification with 96-well block', 0, '2026-06-08 08:12:26'),
(5, 'Electron Microscope', 'Object Analysis', 'Lab', 'inuse', '', 2, '2026-06-11 03:42:21');

-- --------------------------------------------------------

--
-- Table structure for table `experiments`
--

CREATE TABLE `experiments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `booking_id` int(11) DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `equipment_used` varchar(100) DEFAULT NULL,
  `progress` int(11) DEFAULT 0,
  `status` enum('active','completed','cancelled') DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `results` text DEFAULT NULL,
  `started_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `experiments`
--

INSERT INTO `experiments` (`id`, `user_id`, `booking_id`, `title`, `equipment_used`, `progress`, `status`, `notes`, `results`, `started_at`, `completed_at`) VALUES
(1, 6, 1, 'Experiment with Electron Microscope', 'Electron Microscope', 100, 'completed', 'akasjdlkfjalksdjflkasdjfl', NULL, '2026-06-11 14:25:43', '2026-06-11 14:26:12'),
(2, 6, 2, 'Experiment with Centrifuge X-20', 'Centrifuge X-20', 100, 'completed', 'complete', NULL, '2026-06-12 21:29:16', '2026-06-12 21:29:58');

-- --------------------------------------------------------

--
-- Table structure for table `experiment_results`
--

CREATE TABLE `experiment_results` (
  `id` int(11) NOT NULL,
  `experiment_id` int(11) NOT NULL,
  `title` varchar(200) DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `file_name` varchar(100) DEFAULT NULL,
  `conclusion` text DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `experiment_results`
--

INSERT INTO `experiment_results` (`id`, `experiment_id`, `title`, `file_path`, `file_name`, `conclusion`, `uploaded_at`) VALUES
(1, 1, 'a;lkdfaldjflkasdjfl', 'uploads\\results\\1781187972195-344789689.pdf', 'lab-9-practice-doc.pdf', 'alkdfjladjlffkaj', '2026-06-11 14:26:12'),
(2, 2, 'a;lkdfaldjflkasdjfl', 'uploads\\results\\1781299798691-936674502.png', 'ChatGPT Image May 2, 2026, 02_44_31 AM.png', 'we solve this', '2026-06-12 21:29:58');

-- --------------------------------------------------------

--
-- Table structure for table `maintenance_records`
--

CREATE TABLE `maintenance_records` (
  `id` int(11) NOT NULL,
  `equipment_id` int(11) NOT NULL,
  `maintenance_date` date NOT NULL,
  `maintenance_type` varchar(100) DEFAULT NULL,
  `technician_name` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `next_maintenance_date` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) DEFAULT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `messages`
--

INSERT INTO `messages` (`id`, `sender_id`, `receiver_id`, `message`, `is_read`, `created_at`) VALUES
(1, 6, 1, 'Hello', 0, '2026-06-12 21:12:50'),
(2, 2, NULL, 'Hello', 0, '2026-06-12 21:13:19'),
(3, 6, 1, 'Hello', 0, '2026-06-12 21:14:23'),
(4, 5, 1, 'Hello', 0, '2026-06-12 21:25:43'),
(5, 5, 1, 'Hello sir', 0, '2026-06-12 21:56:15'),
(6, 2, 4, 'Hello', 0, '2026-06-12 21:57:10'),
(7, 5, 1, 'we need to solve this', 0, '2026-06-12 21:58:05'),
(8, 2, 5, 'Hello Arafat', 0, '2026-06-12 22:04:10'),
(9, 5, 1, 'welcome', 0, '2026-06-12 22:04:45'),
(10, 5, 1, 'Hello sir do  you hear me', 0, '2026-06-12 22:06:36'),
(11, 2, 6, 'hello maisha', 0, '2026-06-12 22:08:46'),
(12, 6, 1, 'Hello sir', 0, '2026-06-12 22:24:45'),
(13, 2, NULL, 'Hello', 0, '2026-06-12 22:25:26'),
(14, 5, 1, 'Hello sir', 0, '2026-06-12 22:26:17'),
(15, 2, 6, 'hello m', 0, '2026-06-12 22:27:30'),
(16, 6, 1, 'yes please tell me', 0, '2026-06-12 22:28:17');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_resets`
--

CREATE TABLE `password_resets` (
  `id` int(11) NOT NULL,
  `email` varchar(100) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sop_documents`
--

CREATE TABLE `sop_documents` (
  `id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `equipment_type` varchar(100) DEFAULT NULL,
  `document_type` enum('sop','safety','manual') NOT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `uploaded_by` int(11) DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `equipment_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sop_documents`
--

INSERT INTO `sop_documents` (`id`, `title`, `equipment_type`, `document_type`, `file_path`, `file_name`, `description`, `uploaded_by`, `uploaded_at`, `equipment_id`) VALUES
(1, 'how to use', NULL, 'manual', 'uploads\\sop\\1781298718057-470506050.png', 'Screenshot 2026-04-09 120129.png', 'follow the rules', 2, '2026-06-12 21:11:58', 2);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','supervisor','researcher','student') NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  `is_approved` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `email`, `password_hash`, `role`, `department`, `is_approved`, `created_at`, `last_login`) VALUES
(1, 'Admin User', 'admin@lab.com', '$2a$10$LClXgZuvOUPU45LaqBgHF.MUiPkv62f872UWNyNnlBu/q9Gcn2Bpi', 'admin', 'Administration', 1, '2026-06-08 08:12:26', '2026-06-13 16:35:11'),
(2, 'Dr. Sarah Johnson', 'sarah@lab.com', '$2a$10$LClXgZuvOUPU45LaqBgHF.MUiPkv62f872UWNyNnlBu/q9Gcn2Bpi', 'supervisor', 'Biotechnology', 1, '2026-06-08 08:12:26', '2026-06-12 22:29:00'),
(4, 'Kamrul Zaman', 'kamrul@lab.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr7vMqK8Y0qDqZ5qRqLqLqLqLqLq', 'student', 'Computer Science', 1, '2026-06-08 08:12:26', NULL),
(5, 'Arafat', 'kamrul174012@gmail.com', '$2a$10$gPJ1DiMn3c4YVXY5nFkHJu7IcIPtjf9o.Bt6mxliICcqP0/glgEBu', 'student', NULL, 1, '2026-06-10 16:45:04', '2026-06-12 22:26:41'),
(6, 'Maisa', 'maisa@gmail.com', '$2a$10$P7P53TrVtr.x2R.UOSZZ.uEgNqv6va6FDiQJyFo9Qn3tsDutGGQvG', 'researcher', NULL, 1, '2026-06-11 07:00:51', '2026-06-12 22:27:47');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `equipment_id` (`equipment_id`),
  ADD KEY `reviewed_by` (`reviewed_by`),
  ADD KEY `idx_bookings_user` (`user_id`),
  ADD KEY `idx_bookings_status` (`status`),
  ADD KEY `idx_bookings_dates` (`start_time`,`end_time`);

--
-- Indexes for table `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reported_by` (`reported_by`),
  ADD KEY `idx_damage_reports_equipment` (`equipment_id`);

--
-- Indexes for table `equipment`
--
ALTER TABLE `equipment`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `experiments`
--
ALTER TABLE `experiments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `booking_id` (`booking_id`),
  ADD KEY `idx_experiments_user` (`user_id`),
  ADD KEY `idx_experiments_status` (`status`);

--
-- Indexes for table `experiment_results`
--
ALTER TABLE `experiment_results`
  ADD PRIMARY KEY (`id`),
  ADD KEY `experiment_id` (`experiment_id`);

--
-- Indexes for table `maintenance_records`
--
ALTER TABLE `maintenance_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `equipment_id` (`equipment_id`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sender_receiver` (`sender_id`,`receiver_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_messages_unread` (`receiver_id`,`is_read`),
  ADD KEY `idx_messages_timestamp` (`created_at`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_user_read` (`user_id`,`is_read`);

--
-- Indexes for table `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_email` (`email`);

--
-- Indexes for table `sop_documents`
--
ALTER TABLE `sop_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `uploaded_by` (`uploaded_by`),
  ADD KEY `equipment_id` (`equipment_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `damage_reports`
--
ALTER TABLE `damage_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `equipment`
--
ALTER TABLE `equipment`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `experiments`
--
ALTER TABLE `experiments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `experiment_results`
--
ALTER TABLE `experiment_results`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `maintenance_records`
--
ALTER TABLE `maintenance_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `password_resets`
--
ALTER TABLE `password_resets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sop_documents`
--
ALTER TABLE `sop_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `bookings`
--
ALTER TABLE `bookings`
  ADD CONSTRAINT `bookings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bookings_ibfk_2` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bookings_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `damage_reports`
--
ALTER TABLE `damage_reports`
  ADD CONSTRAINT `damage_reports_ibfk_1` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `damage_reports_ibfk_2` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `experiments`
--
ALTER TABLE `experiments`
  ADD CONSTRAINT `experiments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `experiments_ibfk_2` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `experiment_results`
--
ALTER TABLE `experiment_results`
  ADD CONSTRAINT `experiment_results_ibfk_1` FOREIGN KEY (`experiment_id`) REFERENCES `experiments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `maintenance_records`
--
ALTER TABLE `maintenance_records`
  ADD CONSTRAINT `maintenance_records_ibfk_1` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sop_documents`
--
ALTER TABLE `sop_documents`
  ADD CONSTRAINT `sop_documents_ibfk_1` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `sop_documents_ibfk_2` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
