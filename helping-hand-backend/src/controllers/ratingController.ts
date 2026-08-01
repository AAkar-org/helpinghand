import { Request, Response } from 'express';
import pool from '../db/db.js';

export const submitRating = async (req: Request, res: Response): Promise<void> => {
    try {
        const { shiftId, reviewerId, revieweeId, reviewerRole, ratingStars, reviewComment } = req.body;

        if (!shiftId || !reviewerId || !revieweeId || !reviewerRole || ratingStars === undefined) {
            res.status(400).json({
                success: false,
                error: 'shiftId, reviewerId, revieweeId, reviewerRole ("employer"|"worker"), and ratingStars (1-5) are required'
            });
            return;
        }

        const stars = Math.min(5, Math.max(1, Number(ratingStars)));

        const insertResult = await pool.query(
            `INSERT INTO ratings (shift_id, reviewer_id, reviewee_id, reviewer_role, rating_stars, review_comment)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [shiftId, reviewerId, revieweeId, reviewerRole, stars, reviewComment ? reviewComment.trim() : null]
        );

        const rating = insertResult.rows[0];

        if (reviewerRole === 'employer') {
            // Update Worker Reputation & Total Completed Shifts Count
            const avgRes = await pool.query(
                `SELECT AVG(rating_stars) as avg_rating, COUNT(rating_id) as total_ratings
                 FROM ratings
                 WHERE reviewee_id = $1 AND reviewer_role = 'employer'`,
                [revieweeId]
            );

            const newAvgRating = Math.round(Number(avgRes.rows[0].avg_rating || 5.0) * 100) / 100;
            const totalRatings = Number(avgRes.rows[0].total_ratings || 0);

            const completedShiftsRes = await pool.query(
                `SELECT COUNT(shift_id) as completed_count
                 FROM shifts
                 WHERE worker_id = $1 AND status = 'COMPLETED'`,
                [revieweeId]
            );
            const totalCompleted = Number(completedShiftsRes.rows[0].completed_count || 0);

            await pool.query(
                `UPDATE workers 
                 SET average_rating = $1, trust_score = $1, total_ratings_count = $2, total_completed_shifts = $3
                 WHERE worker_id = $4`,
                [newAvgRating, totalRatings, totalCompleted, revieweeId]
            );
        } else {
            // Update Employer Rating
            const empAvgRes = await pool.query(
                `SELECT AVG(rating_stars) as avg_rating
                 FROM ratings
                 WHERE reviewee_id = $1 AND reviewer_role = 'worker'`,
                [revieweeId]
            );

            const newEmpRating = Math.round(Number(empAvgRes.rows[0].avg_rating || 5.0) * 100) / 100;
            await pool.query(
                `UPDATE employers SET trust_rating = $1 WHERE employer_id = $2`,
                [newEmpRating, revieweeId]
            );
        }

        res.status(201).json({
            success: true,
            message: 'Rating and review submitted successfully.',
            rating
        });
    } catch (error: any) {
        console.error('Error in submitRating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getWorkerMapSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const { workerId } = req.params;
        const targetWorkerId = Array.isArray(workerId) ? workerId[0] : workerId;

        const workerRes = await pool.query(
            `SELECT worker_id, phone_number, worker_category, worker_sub_category, 
                    is_available, trust_score, average_rating, total_completed_shifts, 
                    total_ratings_count, is_verified_id, last_known_lat, last_known_lng
             FROM workers
             WHERE worker_id = $1`,
            [targetWorkerId]
        );

        if (workerRes.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Worker not found' });
            return;
        }

        const worker = workerRes.rows[0];

        // Fetch top 2 recent reviews
        const reviewsRes = await pool.query(
            `SELECT rating_stars, review_comment, created_at
             FROM ratings
             WHERE reviewee_id = $1 AND reviewer_role = 'employer' AND review_comment IS NOT NULL
             ORDER BY created_at DESC
             LIMIT 2`,
            [targetWorkerId]
        );

        res.status(200).json({
            success: true,
            mapSummaryCard: {
                workerId: worker.worker_id,
                workerCategory: worker.worker_category,
                workerSubCategory: worker.worker_sub_category,
                trustScore: Number(worker.trust_score),
                averageRating: Number(worker.average_rating),
                totalCompletedShifts: Number(worker.total_completed_shifts),
                totalRatingsCount: Number(worker.total_ratings_count),
                isVerifiedId: worker.is_verified_id,
                recentReviews: reviewsRes.rows.map(r => ({
                    stars: r.rating_stars,
                    comment: r.review_comment,
                    date: r.created_at
                }))
            }
        });
    } catch (error: any) {
        console.error('Error in getWorkerMapSummary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getWorkerMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { workerId } = req.params;
        const targetWorkerId = Array.isArray(workerId) ? workerId[0] : workerId;

        const workerRes = await pool.query(
            `SELECT * FROM workers WHERE worker_id = $1`,
            [targetWorkerId]
        );

        if (workerRes.rows.length === 0) {
            res.status(404).json({ success: false, error: 'Worker not found' });
            return;
        }

        const worker = workerRes.rows[0];

        // Fetch full ratings & feedback history
        const reviewsRes = await pool.query(
            `SELECT r.rating_stars, r.review_comment, r.created_at, e.full_name as reviewer_name
             FROM ratings r
             JOIN employers e ON r.reviewer_id = e.employer_id
             WHERE r.reviewee_id = $1 AND r.reviewer_role = 'employer'
             ORDER BY r.created_at DESC`,
            [targetWorkerId]
        );

        // Fetch completed shifts history
        const shiftsRes = await pool.query(
            `SELECT s.shift_id, s.status, s.agreed_daily_wage, s.adjusted_wage, 
                    s.actual_cash_paid, s.worked_hours, s.end_time as completed_at,
                    e.full_name as employer_name
             FROM shifts s
             JOIN employers e ON s.employer_id = e.employer_id
             WHERE s.worker_id = $1 AND s.status = 'COMPLETED'
             ORDER BY s.end_time DESC`,
            [targetWorkerId]
        );

        res.status(200).json({
            success: true,
            workerProfile: {
                workerId: worker.worker_id,
                phoneNumber: worker.phone_number,
                workerCategory: worker.worker_category,
                workerSubCategory: worker.worker_sub_category,
                isAvailable: worker.is_available,
                trustScore: Number(worker.trust_score),
                averageRating: Number(worker.average_rating),
                totalCompletedShifts: Number(worker.total_completed_shifts),
                totalRatingsCount: Number(worker.total_ratings_count),
                isVerifiedId: worker.is_verified_id,
                reviewsList: reviewsRes.rows.map(r => ({
                    stars: r.rating_stars,
                    comment: r.review_comment,
                    reviewerName: r.reviewer_name,
                    date: r.created_at
                })),
                completedShiftsHistory: shiftsRes.rows.map(s => ({
                    shiftId: s.shift_id,
                    employerName: s.employer_name,
                    wage: Number(s.adjusted_wage ?? s.agreed_daily_wage),
                    actualCashPaid: Number(s.actual_cash_paid),
                    workedHours: s.worked_hours ? Number(s.worked_hours) : 8,
                    completedAt: s.completed_at
                }))
            }
        });
    } catch (error: any) {
        console.error('Error in getWorkerMyProfile:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
