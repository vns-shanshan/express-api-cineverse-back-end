const express = require("express");
const router = express.Router();

const Movie = require("../models/movie");

const verifyToken = require("../middleware/verify-token");
const authenticateOptional = require("../middleware/authenticate-optional");

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const s3client = new S3Client({
    region: "us-west-1"
});
const { v4: uuidv } = require("uuid");

const multer = require("multer");
const upload = multer();

router.get("/", authenticateOptional, async (req, res) => {
    try {
        let movieDocs = [];

        if (!req.user) {
            movieDocs = await Movie
                .find({})
                .populate("user", "username")
                .sort({ _id: -1 });
        } else {
            movieDocs = await Movie
                .find({ user: req.user._id }).sort({ _id: -1 });

        }

        res.status(200).json(movieDocs);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.post("/", verifyToken, upload.single('photo'), async (req, res) => {


    try {
        const filePath = `movie/${uuidv()}-${req.file.originalname}`;

        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET,
            Key: filePath,
            Body: req.file.buffer
        });

        const response = await s3client.send(command);
        console.log("Upload Success", response);

        try {
            req.body.photo = `https://${process.env.BUCKET}.s3.us-west-1.amazonaws.com/${filePath}`

            req.body.user = req.user._id;

            const createdMovie = await Movie.create(req.body);


            res.status(201).json(createdMovie);
        } catch (err) {
            res.status(500).json({ err: err.message });
        }
    } catch (err) {
        console.log(err, "<- aws error keys are probably wrong, check credentials.");
        res.status(500).json({ err: err.message });
    }


});

router.get("/:movieId", async (req, res) => {
    try {
        const selectedMovie = await Movie.findById(req.params.movieId).populate("user", "username").populate("comments.author_id", "username").lean();

        if (!selectedMovie) {
            return res.status(404).json({ err: "Movie not found" });
        }

        selectedMovie.comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        res.status(200).json(selectedMovie);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.put("/:movieId", verifyToken, upload.single('photo'), async (req, res) => {
    try {
        const userMovieDoc = await Movie.findOne({ user: req.user._id, _id: req.params.movieId });

        if (!userMovieDoc) {

            res.status(403).json({ message: "You are not allowed to update this movie." });
        }

        if (!!req.file) {
            // buffer exists, new photo submitted
            // upload to aws and get the new url back
            const filePath = `movie/${uuidv()}-${req.file.originalname}`;

            const command = new PutObjectCommand({
                Bucket: process.env.BUCKET,
                Key: filePath,
                Body: req.file.buffer
            });

            const response = await s3client.send(command);
            // console.log(response)
            req.body.photo = `https://${process.env.BUCKET}.s3.us-west-1.amazonaws.com/${filePath}`
        } else {
            // photo is not changed. reg.body.photo is a URL
            // do nothing
        }

        const updatedMovie = await Movie.findByIdAndUpdate(req.params.movieId, req.body, { new: true });

        updatedMovie._doc.user = req.user;

        res.status(200).json(updatedMovie);

    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.delete("/:movieId", verifyToken, async (req, res) => {
    console.log(req.params.movieId)
    try {
        const userMovieDoc = await Movie.findById(req.params.movieId);

        if (!userMovieDoc.user.equals(req.user._id)) {
            return res.status(403).json({ message: "You are not allowed to delete this movie." });
        }

        const deletedUserMovie = await Movie.findByIdAndDelete(req.params.movieId);

        res.status(200).json({ message: "Movie was successfully deleted." });
    } catch (err) {
        res.status(500).json({ err: err.message })
    }
});

router.post("/:movieId/comments", verifyToken, async (req, res) => {
    try {
        const movieDoc = await Movie.findById(req.params.movieId);

        if (!movieDoc) {
            return res.status(404).json({ err: "Movie not found." });
        }

        const newComment = {
            author_id: req.user._id,
            commentDetails: req.body.commentDetails
        }

        // console.log(newComment)

        movieDoc.comments.push(newComment);

        await movieDoc.save();

        const updatedMovie = await Movie.findById(req.params.movieId)
            .populate("comments.author_id", "username")

        res.status(201).json(updatedMovie)
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.get("/:movieId/comments/:commentId", verifyToken, async (req, res) => {
    try {
        const movieDoc = await Movie.findById(req.params.movieId);

        if (!movieDoc) {
            return res.status(404).json({ err: "Movie not found." });
        }

        const foundComment = movieDoc.comments.id(req.params.commentId);

        if (!foundComment) {
            return res.status(404).json({ err: "Comment not found." });
        }

        if (foundComment.author_id.toString() !== req.user._id) {
            return res.status(403).json({ message: "You are not authorized to edit this comment." });
        }

        res.status(200).json(foundComment);

    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.put("/:movieId/comments/:commentId", verifyToken, async (req, res) => {
    try {
        const movieDoc = await Movie.findById(req.params.movieId);

        if (!movieDoc) {
            return res.status(404).json({ err: "Movie not found." });
        }

        const foundComment = movieDoc.comments.id(req.params.commentId);

        if (!foundComment) {
            return res.status(404).json({ err: "Comment not found." });
        }

        if (foundComment.author_id.toString() !== req.user._id) {
            return res.status(403).json({ message: "You are not authorized to edit this comment." });
        }

        foundComment.commentDetails = req.body.commentDetails;

        await movieDoc.save();

        const updatedMovie = await Movie.findById(req.params.movieId);

        res.status(200).json(updatedMovie);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

router.delete("/:movieId/comments/:commentId", verifyToken, async (req, res) => {
    try {
        const movieDoc = await Movie.findById(req.params.movieId);

        if (!movieDoc) {
            return res.status(404).json({ err: "Movie not found." });
        }

        const commentToDelete = movieDoc.comments.id(req.params.commentId);

        if (!commentToDelete) {
            return res.status(404).json({ err: "Comment not found." });
        }

        if (commentToDelete.author_id.toString() !== req.user._id) {
            return res.status(403).json({ message: "You are not authorized to delete this comment." });
        }

        movieDoc.comments.pull(req.params.commentId);

        await movieDoc.save();

        res.status(200).json({ message: "Comment deleted successfully." });
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

module.exports = router;